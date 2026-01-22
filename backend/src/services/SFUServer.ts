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
    console.log("[SFU] Booting SFU Server...");

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

    console.log("[SFU] Socket.IO initialized");
  }

  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        console.log(`[AUTH] Incoming socket: ${socket.id}`);

        const token = socket.handshake.auth.token;
        if (!token) {
          console.error("[AUTH] No JWT token provided");
          return next(new Error("Authentication error"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
        };

        const user = await User.findById(decoded.userId);
        if (!user) {
          console.error("[AUTH] Invalid token, user not found");
          return next(new Error("Authentication error"));
        }

        socket.userId = user._id.toString();
        socket.userName = user.name;
        socket.userEmail = user.email;

        console.log(`[AUTH] Socket authenticated: ${socket.userId} (${user.email})`);
        next();
      } catch (error) {
        console.error("[AUTH] JWT verification failed:", error);
        next(new Error("Authentication error"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`[CONNECT] User ${socket.userId} connected with socket ${socket.id}`);

      socket.on("join-meeting", async ({ meetingId }) => {
        console.log(`[ROOM] ${socket.userId} attempting to join ${meetingId}`);

        try {
          const meeting = await Meeting.findOne({ meetingId, isActive: true });
          if (!meeting) {
            console.error(`[ROOM] Meeting not found: ${meetingId}`);
            socket.emit("error", { message: "Meeting not found or ended" });
            return;
          }

          socket.join(meetingId);
          socket.meetingId = meetingId;

          if (!this.meetings.has(meetingId)) {
            console.log(`[ROOM] Creating new room: ${meetingId}`);
            this.meetings.set(meetingId, {
              meetingId,
              participants: new Map(),
              host: meeting.hostId.toString(),
            });
          }

          const room = this.meetings.get(meetingId)!;

          room.participants.set(socket.id, {
            socketId: socket.id,
            userId: socket.userId!,
            joinedAt: new Date(),
            latency: 0,
            bandwidth: { up: 0, down: 0 },
          });

          console.log(`[ROOM] ${socket.userId} joined ${meetingId}. Total: ${room.participants.size}`);

          socket.to(meetingId).emit("user-joined", {
            userId: socket.userId,
            socketId: socket.id,
            name: socket.userName,
            email: socket.userEmail,
          });

          const existingParticipants = await Promise.all(
            Array.from(room.participants.values())
              .filter(p => p.socketId !== socket.id)
              .map(async p => {
                const userInfo = await this.getUserInfo(p.userId);
                return { ...p, name: userInfo?.name, email: userInfo?.email };
              })
          );

          socket.emit("existing-participants", existingParticipants);
          socket.emit("room-info", {
            meetingId,
            participants: Array.from(room.participants.values()),
            isHost: room.host === socket.userId,
          });
        } catch (err) {
          console.error("[ROOM] Join failed:", err);
          socket.emit("error", { message: "Failed to join meeting" });
        }
      });

      socket.on("offer", d => {
        console.log(`[RTC] Offer from ${socket.id} to ${d.to}`);
        socket.to(d.to).emit("offer", { from: socket.id, offer: d.offer });
      });

      socket.on("answer", d => {
        console.log(`[RTC] Answer from ${socket.id} to ${d.to}`);
        socket.to(d.to).emit("answer", { from: socket.id, answer: d.answer });
      });

      socket.on("ice-candidate", d => {
        console.log(`[RTC] ICE from ${socket.id} to ${d.to}`);
        socket.to(d.to).emit("ice-candidate", { from: socket.id, candidate: d.candidate });
      });

      socket.on("toggle-audio", d => {
        console.log(`[MEDIA] Audio ${d.enabled ? "ON" : "OFF"} by ${socket.userId}`);
        socket.to(socket.meetingId!).emit("user-audio-toggled", { socketId: socket.id, enabled: d.enabled });
      });

      socket.on("toggle-video", d => {
        console.log(`[MEDIA] Video ${d.enabled ? "ON" : "OFF"} by ${socket.userId}`);
        socket.to(socket.meetingId!).emit("user-video-toggled", { socketId: socket.id, enabled: d.enabled });
      });

      socket.on("stats-update", d => {
        const room = this.meetings.get(socket.meetingId!);
        if (room?.participants.has(socket.id)) {
          room.participants.get(socket.id)!.latency = d.latency;
          room.participants.get(socket.id)!.bandwidth = d.bandwidth;
          console.log(`[STATS] ${socket.userId} latency=${d.latency}ms up=${d.bandwidth.up}kbps down=${d.bandwidth.down}kbps`);
        }
      });

      socket.on("disconnect", () => {
        console.log(`[DISCONNECT] ${socket.userId} (${socket.id})`);

        const room = this.meetings.get(socket.meetingId!);
        if (room) {
          room.participants.delete(socket.id);
          socket.to(socket.meetingId!).emit("user-left", { socketId: socket.id });

          if (room.participants.size === 0) {
            console.log(`[ROOM] Destroying empty room ${socket.meetingId}`);
            this.meetings.delete(socket.meetingId!);
          }
        }
      });
    });
  }

  public getMeetingStats(meetingId: string) {
    const room = this.meetings.get(meetingId);
    if (!room) return null;

    console.log(`[STATS] Fetching room stats for ${meetingId}`);
    return {
      meetingId,
      participantCount: room.participants.size,
      participants: Array.from(room.participants.values()),
    };
  }

  private async getUserInfo(userId: string) {
    try {
      console.log(`[DB] Fetching user ${userId}`);
      return await User.findById(userId).select("name email");
    } catch (error) {
      console.error("[DB] User lookup failed:", error);
      return null;
    }
  }
}
