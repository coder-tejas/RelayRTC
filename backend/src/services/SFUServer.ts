import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Meeting } from "../models/Meeting";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
  userEmail?: string;
  meetingId?: string;
}

interface ConnectionStats {
  socketId: string;
  userId: string;
  name?: string;
  email?: string;
  joinedAt: Date;
  latency: number;
  bandwidth: {
    up: number;
    down: number;
  };
}

interface MeetingRoom {
  meetingId: string;
  participants: Map<string, ConnectionStats>;
  host: string;
}

export class SFUServer {
  private io: SocketIOServer;
  private meetings: Map<string, MeetingRoom> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "https://t3001.tusharsukhwal.com",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error("Authentication error"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
        };
        const user = await User.findById(decoded.userId);

        if (!user) {
          return next(new Error("Authentication error"));
        }

        socket.userId = (user._id as any).toString();
        socket.userName = user.name;
        socket.userEmail = user.email;
        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected`);

      // Join meeting room
      socket.on("join-meeting", async (data: { meetingId: string }) => {
        try {
          const { meetingId } = data;

          // Verify meeting exists and user can join
          const meeting = await Meeting.findOne({ meetingId, isActive: true });
          if (!meeting) {
            socket.emit("error", { message: "Meeting not found or ended" });
            return;
          }

          // Join socket to room
          socket.join(meetingId);
          socket.meetingId = meetingId;

          // Initialize or get meeting room
          if (!this.meetings.has(meetingId)) {
            this.meetings.set(meetingId, {
              meetingId,
              participants: new Map(),
              host: meeting.hostId.toString(),
            });
          }

          const room = this.meetings.get(meetingId)!;

          // Add participant to room
          room.participants.set(socket.id, {
            socketId: socket.id,
            userId: socket.userId!,
            joinedAt: new Date(),
            latency: 0,
            bandwidth: { up: 0, down: 0 },
          });

          // Notify existing participants about new user
          socket.to(meetingId).emit("user-joined", {
            userId: socket.userId,
            socketId: socket.id,
            name: socket.userName || "Unknown User",
            email: socket.userEmail || "",
          });

          // Send existing participants to new user with user info
          const existingParticipants = await Promise.all(
            Array.from(room.participants.values())
              .filter((p) => p.socketId !== socket.id)
              .map(async (p) => {
                const userInfo = p.userId
                  ? await this.getUserInfo(p.userId)
                  : null;
                return {
                  ...p,
                  name: userInfo?.name || "Unknown User",
                  email: userInfo?.email || "",
                };
              })
          );

          socket.emit("existing-participants", existingParticipants);

          // Send room info
          socket.emit("room-info", {
            meetingId,
            participants: Array.from(room.participants.values()),
            isHost: room.host === socket.userId,
          });
        } catch (error) {
          socket.emit("error", { message: "Failed to join meeting" });
        }
      });

      // Handle WebRTC signaling
      socket.on(
        "offer",
        (data: { to: string; offer: RTCSessionDescriptionInit }) => {
          socket.to(data.to).emit("offer", {
            from: socket.id,
            offer: data.offer,
          });
        }
      );

      socket.on(
        "answer",
        (data: { to: string; answer: RTCSessionDescriptionInit }) => {
          socket.to(data.to).emit("answer", {
            from: socket.id,
            answer: data.answer,
          });
        }
      );

      socket.on(
        "ice-candidate",
        (data: { to: string; candidate: RTCIceCandidateInit }) => {
          socket.to(data.to).emit("ice-candidate", {
            from: socket.id,
            candidate: data.candidate,
          });
        }
      );

      // Handle media control
      socket.on("toggle-audio", (data: { enabled: boolean }) => {
        if (socket.meetingId) {
          socket.to(socket.meetingId).emit("user-audio-toggled", {
            userId: socket.userId,
            socketId: socket.id,
            enabled: data.enabled,
          });
        }
      });

      socket.on("toggle-video", (data: { enabled: boolean }) => {
        if (socket.meetingId) {
          socket.to(socket.meetingId).emit("user-video-toggled", {
            userId: socket.userId,
            socketId: socket.id,
            enabled: data.enabled,
          });
        }
      });

      // Handle connection stats updates
      socket.on(
        "stats-update",
        (data: {
          latency: number;
          bandwidth: { up: number; down: number };
        }) => {
          if (socket.meetingId) {
            const room = this.meetings.get(socket.meetingId);
            if (room && room.participants.has(socket.id)) {
              const participant = room.participants.get(socket.id)!;
              participant.latency = data.latency;
              participant.bandwidth = data.bandwidth;
            }
          }
        }
      );

      // Get connection stats
      socket.on("get-stats", () => {
        if (socket.meetingId) {
          const room = this.meetings.get(socket.meetingId);
          if (room) {
            const stats = Array.from(room.participants.values());
            socket.emit("connection-stats", stats);
          }
        }
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User ${socket.userId} disconnected`);

        if (socket.meetingId) {
          const room = this.meetings.get(socket.meetingId);
          if (room) {
            room.participants.delete(socket.id);

            // Notify other participants
            socket.to(socket.meetingId).emit("user-left", {
              userId: socket.userId,
              socketId: socket.id,
            });

            // Clean up empty rooms
            if (room.participants.size === 0) {
              this.meetings.delete(socket.meetingId);
            }
          }
        }
      });

      // Handle leaving meeting
      socket.on("leave-meeting", () => {
        if (socket.meetingId) {
          const room = this.meetings.get(socket.meetingId);
          if (room) {
            room.participants.delete(socket.id);

            socket.to(socket.meetingId).emit("user-left", {
              userId: socket.userId,
              socketId: socket.id,
            });

            socket.leave(socket.meetingId);
            socket.meetingId = undefined;

            // Clean up empty rooms
            if (room.participants.size === 0) {
              this.meetings.delete(socket.meetingId);
            }
          }
        }
      });

      // Handle screen sharing
      socket.on("start-screen-share", () => {
        if (socket.meetingId) {
          socket.to(socket.meetingId).emit("user-started-screen-share", {
            userId: socket.userId,
            socketId: socket.id,
          });
        }
      });

      socket.on("stop-screen-share", () => {
        if (socket.meetingId) {
          socket.to(socket.meetingId).emit("user-stopped-screen-share", {
            userId: socket.userId,
            socketId: socket.id,
          });
        }
      });
    });
  }

  public getMeetingStats(meetingId: string) {
    const room = this.meetings.get(meetingId);
    if (!room) return null;

    return {
      meetingId,
      participantCount: room.participants.size,
      participants: Array.from(room.participants.values()),
    };
  }

  // Helper method to get user info from database
  private async getUserInfo(userId: string) {
    try {
      console.log(`🔍 Fetching user info for userId: ${userId}`);
      const user = await User.findById(userId).select("name email");
      console.log(`✅ Found user:`, user);
      return user;
    } catch (error) {
      console.error("❌ Error fetching user info:", error);
      return null;
    }
  }
}
