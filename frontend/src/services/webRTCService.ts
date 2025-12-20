import { io, Socket } from "socket.io-client";
import {
  useGlobalState,
  Participant,
  ConnectionStats,
} from "../state/globalState";

class WebRTCService {
  private socket: Socket | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private statsInterval: NodeJS.Timeout | null = null;
  private pendingOffers: Map<string, RTCSessionDescriptionInit> = new Map();
  private pendingAnswers: Map<string, RTCSessionDescriptionInit> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private processingAnswers: Set<string> = new Set();
  private processingOffers: Set<string> = new Set();
  private processingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  constructor() {
    this.bindStateActions();
  }

  private bindStateActions() {
    // We'll access the state directly through useGlobalState methods
  }

  // Initialize socket connection
  async connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io("https://t3000.tusharsukhwal.com", {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      this.socket.on("connect", () => {
        console.log("Connected to signaling server");
        this.setupSocketEventHandlers();
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        reject(error);
      });
    });
  }

  // Setup socket event handlers
  private setupSocketEventHandlers() {
    if (!this.socket) return;

    // Room events
    this.socket.on(
      "room-info",
      (data: { meetingId: string; participants: any[]; isHost: boolean }) => {
        useGlobalState.getState().setIsHost(data.isHost);
      }
    );

    this.socket.on("existing-participants", (participants: any[]) => {
      participants.forEach((participant) => {
        console.log(
          `➕ Adding existing participant: ${participant.socketId}`,
          participant
        );

        // Add participant to global state
        useGlobalState.getState().addParticipant({
          id: participant.userId || participant.socketId,
          name: participant.name || "Unknown User",
          email: participant.email || "",
          socketId: participant.socketId,
          isAudioEnabled: participant.isAudioEnabled ?? true,
          isVideoEnabled: participant.isVideoEnabled ?? true,
          isScreenSharing: participant.isScreenSharing ?? false,
        });

        this.createPeerConnection(participant.socketId, false); // false = not initiator
      });
    });

    this.socket.on(
      "user-joined",
      (data: {
        userId: string;
        socketId: string;
        name?: string;
        email?: string;
      }) => {
        console.log(`👤 User joined: ${data.socketId}`, data);

        // Add participant to global state
        useGlobalState.getState().addParticipant({
          id: data.userId,
          name: data.name || "Unknown User",
          email: data.email || "",
          socketId: data.socketId,
          isAudioEnabled: true,
          isVideoEnabled: true,
          isScreenSharing: false,
        });

        this.createPeerConnection(data.socketId, true); // true = initiator
      }
    );

    this.socket.on(
      "user-left",
      (data: { userId: string; socketId: string }) => {
        this.handleUserLeft(data.socketId);
      }
    );

    // WebRTC signaling events
    this.socket.on(
      "offer",
      async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
        await this.handleOffer(data.from, data.offer);
      }
    );

    this.socket.on(
      "answer",
      async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
        await this.handleAnswer(data.from, data.answer);
      }
    );

    this.socket.on(
      "ice-candidate",
      async (data: { from: string; candidate: RTCIceCandidateInit }) => {
        await this.handleIceCandidate(data.from, data.candidate);
      }
    );

    // Media control events
    this.socket.on(
      "user-audio-toggled",
      (data: { userId: string; socketId: string; enabled: boolean }) => {
        console.log(`🔊 Audio toggled for ${data.socketId}: ${data.enabled}`);
        useGlobalState.getState().updateParticipant(data.socketId, {
          isAudioEnabled: data.enabled,
        });
      }
    );

    this.socket.on(
      "user-video-toggled",
      (data: { userId: string; socketId: string; enabled: boolean }) => {
        console.log(`🎥 Video toggled for ${data.socketId}: ${data.enabled}`);
        useGlobalState.getState().updateParticipant(data.socketId, {
          isVideoEnabled: data.enabled,
        });
      }
    );

    // Connection stats
    this.socket.on("connection-stats", (stats: ConnectionStats[]) => {
      useGlobalState.getState().setConnectionStats(stats);
    });

    // Error handling
    this.socket.on("error", (error: { message: string }) => {
      console.error("Socket error:", error);
    });
  }

  // Get user media (camera and microphone)
  async getUserMedia(
    video: boolean = true,
    audio: boolean = true
  ): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: audio,
      });

      this.localStream = stream;
      useGlobalState.getState().setLocalStream(stream);

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  }

  // Get screen share
  async getScreenShare(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      return stream;
    } catch (error) {
      console.error("Error accessing screen share:", error);
      throw error;
    }
  }

  // Join meeting room
  async joinMeeting(meetingId: string): Promise<void> {
    if (!this.socket) throw new Error("Socket not connected");

    this.socket.emit("join-meeting", { meetingId });

    // Start periodic stats collection
    this.startStatsCollection();
  }

  // Create peer connection
  private async createPeerConnection(
    socketId: string,
    isInitiator: boolean
  ): Promise<RTCPeerConnection> {
    // Check if peer connection already exists
    const existingConnection = this.peerConnections.get(socketId);
    if (existingConnection) {
      console.log(
        `Peer connection already exists for ${socketId}, closing old one`
      );
      existingConnection.close();
    }

    const peerConnection = new RTCPeerConnection(this.configuration);
    this.peerConnections.set(socketId, peerConnection);

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      console.log(`🎥 Received remote stream from ${socketId}:`, remoteStream);
      this.remoteStreams.set(socketId, remoteStream);

      // Update participant with stream (with retry logic)
      const updateParticipantWithStream = () => {
        const state = useGlobalState.getState();
        const participant = state.participants.get(socketId);

        if (participant) {
          console.log(`✅ Updating participant ${socketId} with stream`);
          state.updateParticipant(socketId, { stream: remoteStream });
        } else {
          console.warn(
            `⚠️ Participant ${socketId} not found, retrying in 500ms`
          );
          // Retry after a short delay in case participant is added later
          setTimeout(updateParticipantWithStream, 500);
        }
      };

      updateParticipantWithStream();
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit("ice-candidate", {
          to: socketId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${socketId}:`,
        peerConnection.connectionState
      );

      // Clean up failed connections
      if (peerConnection.connectionState === "failed") {
        console.log(`Connection failed for ${socketId}, cleaning up`);
        this.handleUserLeft(socketId);
      }
    };

    // Handle signaling state changes for debugging
    peerConnection.onsignalingstatechange = () => {
      console.log(
        `Signaling state with ${socketId}:`,
        peerConnection.signalingState
      );
    };

    // Create offer if initiator (with retry logic)
    if (isInitiator) {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        if (this.socket) {
          this.socket.emit("offer", { to: socketId, offer });
        }
      } catch (error) {
        console.error(`Error creating offer for ${socketId}:`, error);
        peerConnection.close();
        this.peerConnections.delete(socketId);
        throw error;
      }
    } else {
      // If not initiator, check for pending messages
      const pendingAnswer = this.pendingAnswers.get(socketId);
      if (pendingAnswer && !this.processingAnswers.has(socketId)) {
        console.log(`🔄 Processing pending answer for ${socketId}`);
        this.pendingAnswers.delete(socketId);
        // Process the pending answer
        setTimeout(() => this.handleAnswer(socketId, pendingAnswer), 100);
      }

      const pendingOffer = this.pendingOffers.get(socketId);
      if (pendingOffer && !this.processingOffers.has(socketId)) {
        console.log(`🔄 Processing pending offer for ${socketId}`);
        this.pendingOffers.delete(socketId);
        // Process the pending offer
        setTimeout(() => this.handleOffer(socketId, pendingOffer), 100);
      }
    }

    return peerConnection;
  }

  // Handle incoming offer
  private async handleOffer(
    socketId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    console.log(`📨 Received offer from ${socketId}`);

    // Prevent concurrent processing of offers for the same socket
    if (this.processingOffers.has(socketId)) {
      console.warn(
        `⚠️ Already processing offer for ${socketId}, queuing this one`
      );
      this.pendingOffers.set(socketId, offer);
      return;
    }

    this.processingOffers.add(socketId);

    // Set a timeout to prevent deadlocks
    const timeout = setTimeout(() => {
      console.warn(
        `⚠️ Offer processing timeout for ${socketId}, removing from processing set`
      );
      this.processingOffers.delete(socketId);
      this.processingTimeouts.delete(socketId);
    }, 5000); // 5 second timeout

    this.processingTimeouts.set(socketId, timeout);

    try {
      let peerConnection = this.peerConnections.get(socketId);

      if (!peerConnection) {
        console.log(`🆕 Creating new peer connection for ${socketId}`);
        peerConnection = await this.createPeerConnection(socketId, false);
      }

      console.log(
        `📊 Current signaling state for ${socketId}: ${peerConnection.signalingState}, connection state: ${peerConnection.connectionState}`
      );

      // Check if we have a local offer pending (offer collision)
      if (peerConnection.signalingState === "have-local-offer") {
        console.log(
          `⚡ Offer collision detected with ${socketId}, handling as answerer`
        );
        // Remove the existing peer connection and create a new one as answerer
        peerConnection.close();
        peerConnection = await this.createPeerConnection(socketId, false);
      }

      // Only proceed if we're in a valid state to receive an offer
      if (peerConnection.signalingState === "stable") {
        console.log(
          `✅ About to set remote description (offer) for ${socketId}`
        );

        // Final state check right before the critical operation
        if (peerConnection.signalingState !== "stable") {
          console.warn(
            `❌ State changed during offer processing for ${socketId}, now: ${peerConnection.signalingState}`
          );
          this.pendingOffers.set(socketId, offer);
          return;
        }

        if (peerConnection.remoteDescription) {
          console.warn(
            `❌ Remote description already exists for ${socketId}, ignoring offer`
          );
          return;
        }

        await peerConnection.setRemoteDescription(offer);
        console.log(`✅ Creating answer for ${socketId}`);

        // Check state again before creating answer
        if (peerConnection.signalingState !== "have-remote-offer") {
          console.warn(
            `❌ Unexpected state after setting remote offer for ${socketId}: ${peerConnection.signalingState}`
          );
          return;
        }

        const answer = await peerConnection.createAnswer();
        console.log(
          `✅ About to set local description (answer) for ${socketId}`
        );

        // Final state check before setting local description
        if (peerConnection.signalingState !== "have-remote-offer") {
          console.warn(
            `❌ State changed before setting local answer for ${socketId}: ${peerConnection.signalingState}`
          );
          return;
        }

        if (peerConnection.localDescription) {
          console.warn(
            `❌ Local description already exists for ${socketId}, not setting answer`
          );
          return;
        }

        await peerConnection.setLocalDescription(answer);
        console.log(
          `✅ Successfully set local description (answer) for ${socketId}`
        );

        if (this.socket) {
          console.log(`📤 Sending answer to ${socketId}`);
          this.socket.emit("answer", { to: socketId, answer });
        }

        // Process any pending ICE candidates
        this.processPendingCandidates(socketId);
      } else {
        console.warn(
          `❌ Cannot handle offer from ${socketId}, wrong signaling state: ${peerConnection.signalingState}`
        );
        this.pendingOffers.set(socketId, offer);
      }
    } catch (error) {
      console.error(`❌ Error handling offer from ${socketId}:`, error);

      // Don't immediately close on error - might be recoverable
      if (error.message.includes("Called in wrong state")) {
        console.log(`🔄 Storing offer for ${socketId} to retry later`);
        this.pendingOffers.set(socketId, offer);
      } else {
        // Close only on non-recoverable errors
        console.log(`💀 Closing failed connection for ${socketId}`);
        const peerConnection = this.peerConnections.get(socketId);
        if (peerConnection) {
          peerConnection.close();
          this.peerConnections.delete(socketId);
        }
      }
    } finally {
      // Always remove from processing set and clear timeout
      this.processingOffers.delete(socketId);
      const timeout = this.processingTimeouts.get(socketId);
      if (timeout) {
        clearTimeout(timeout);
        this.processingTimeouts.delete(socketId);
      }
    }
  }

  // Handle incoming answer
  private async handleAnswer(
    socketId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    console.log(`🔄 Received answer from ${socketId}`);

    // Prevent concurrent processing of answers for the same socket
    if (this.processingAnswers.has(socketId)) {
      console.warn(
        `⚠️ Already processing answer for ${socketId}, queuing this one`
      );
      this.pendingAnswers.set(socketId, answer);
      return;
    }

    this.processingAnswers.add(socketId);

    // Set a timeout to prevent deadlocks
    const timeout = setTimeout(() => {
      console.warn(
        `⚠️ Processing timeout for ${socketId}, removing from processing set`
      );
      this.processingAnswers.delete(socketId);
      this.processingTimeouts.delete(socketId);
    }, 5000); // 5 second timeout

    this.processingTimeouts.set(socketId, timeout);

    try {
      const peerConnection = this.peerConnections.get(socketId);

      if (!peerConnection) {
        console.warn(
          `❌ No peer connection found for ${socketId}, storing answer for later`
        );
        this.pendingAnswers.set(socketId, answer);
        return;
      }

      console.log(
        `📊 Current signaling state for ${socketId}: ${peerConnection.signalingState}, connection state: ${peerConnection.connectionState}`
      );

      // Check if we already have a remote description (duplicate answer)
      if (peerConnection.remoteDescription) {
        console.warn(
          `⚠️ Already have remote description for ${socketId}, ignoring duplicate answer`
        );
        return;
      }

      // Only set remote description if we're in the correct state
      if (peerConnection.signalingState === "have-local-offer") {
        console.log(`✅ About to set remote description for ${socketId}`);

        // Final state check right before the critical operation
        if (peerConnection.signalingState !== "have-local-offer") {
          console.warn(
            `❌ State changed during processing for ${socketId}, now: ${peerConnection.signalingState}`
          );
          this.pendingAnswers.set(socketId, answer);
          return;
        }

        if (peerConnection.remoteDescription) {
          console.warn(
            `❌ Remote description appeared during processing for ${socketId}, ignoring`
          );
          return;
        }

        await peerConnection.setRemoteDescription(answer);
        console.log(`✅ Successfully set remote answer for ${socketId}`);

        // Process any pending ICE candidates
        this.processPendingCandidates(socketId);
      } else if (peerConnection.signalingState === "stable") {
        console.warn(
          `⚠️ Peer connection ${socketId} is already in stable state - answer may be duplicate`
        );
      } else {
        console.warn(
          `❌ Cannot set remote answer from ${socketId}, wrong signaling state: ${peerConnection.signalingState}`
        );
        // Store for later if connection is still negotiating
        this.pendingAnswers.set(socketId, answer);
      }
    } catch (error) {
      console.error(`❌ Error handling answer from ${socketId}:`, error);

      // Don't immediately close on error - might be recoverable
      if (error.message.includes("Called in wrong state")) {
        console.log(`🔄 Storing answer for ${socketId} to retry later`);
        this.pendingAnswers.set(socketId, answer);
      } else {
        // Close only on non-recoverable errors
        console.log(`💀 Closing failed connection for ${socketId}`);
        const peerConnection = this.peerConnections.get(socketId);
        if (peerConnection) {
          peerConnection.close();
          this.peerConnections.delete(socketId);
        }
      }
    } finally {
      // Always remove from processing set and clear timeout
      this.processingAnswers.delete(socketId);
      const timeout = this.processingTimeouts.get(socketId);
      if (timeout) {
        clearTimeout(timeout);
        this.processingTimeouts.delete(socketId);
      }
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(
    socketId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const peerConnection = this.peerConnections.get(socketId);

    if (!peerConnection) {
      console.warn(
        `❌ No peer connection found for ICE candidate from ${socketId}, storing for later`
      );
      // Store candidate for when connection is established
      if (!this.pendingCandidates.has(socketId)) {
        this.pendingCandidates.set(socketId, []);
      }
      this.pendingCandidates.get(socketId)!.push(candidate);
      return;
    }

    try {
      // Only add ICE candidates if we have a remote description
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(candidate);
        console.log(`✅ Added ICE candidate for ${socketId}`);
      } else {
        console.warn(
          `⚠️ Cannot add ICE candidate for ${socketId}: no remote description, storing for later`
        );
        // Store candidate for when remote description is set
        if (!this.pendingCandidates.has(socketId)) {
          this.pendingCandidates.set(socketId, []);
        }
        this.pendingCandidates.get(socketId)!.push(candidate);
      }
    } catch (error) {
      console.error(`❌ Error adding ICE candidate for ${socketId}:`, error);
    }
  }

  // Process pending ICE candidates after remote description is set
  private async processPendingCandidates(socketId: string): Promise<void> {
    const pendingCandidates = this.pendingCandidates.get(socketId);
    if (!pendingCandidates || pendingCandidates.length === 0) {
      return;
    }

    const peerConnection = this.peerConnections.get(socketId);
    if (!peerConnection || !peerConnection.remoteDescription) {
      return;
    }

    console.log(
      `🔄 Processing ${pendingCandidates.length} pending ICE candidates for ${socketId}`
    );

    for (const candidate of pendingCandidates) {
      try {
        await peerConnection.addIceCandidate(candidate);
        console.log(`✅ Added pending ICE candidate for ${socketId}`);
      } catch (error) {
        console.error(
          `❌ Error adding pending ICE candidate for ${socketId}:`,
          error
        );
      }
    }

    // Clear processed candidates
    this.pendingCandidates.delete(socketId);
  }

  // Handle user leaving
  private handleUserLeft(socketId: string): void {
    // Close peer connection
    const peerConnection = this.peerConnections.get(socketId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(socketId);
    }

    // Remove remote stream
    this.remoteStreams.delete(socketId);

    // Clean up pending signaling data
    this.pendingOffers.delete(socketId);
    this.pendingAnswers.delete(socketId);
    this.pendingCandidates.delete(socketId);
    this.processingAnswers.delete(socketId);
    this.processingOffers.delete(socketId);

    // Clear any processing timeout
    const timeout = this.processingTimeouts.get(socketId);
    if (timeout) {
      clearTimeout(timeout);
      this.processingTimeouts.delete(socketId);
    }

    // Remove from state
    useGlobalState.getState().removeParticipant(socketId);
  }

  // Restart negotiation for failed connections
  private async restartNegotiation(socketId: string): Promise<void> {
    console.log(`Restarting negotiation with ${socketId}`);

    // Clean up existing connection
    const existingConnection = this.peerConnections.get(socketId);
    if (existingConnection) {
      existingConnection.close();
      this.peerConnections.delete(socketId);
    }

    // Create new connection as initiator
    try {
      await this.createPeerConnection(socketId, true);
    } catch (error) {
      console.error(`Failed to restart negotiation with ${socketId}:`, error);
    }
  }

  // Toggle audio
  toggleAudio(): void {
    const state = useGlobalState.getState();
    const newState = !state.isAudioEnabled;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = newState;
      });
    }

    state.toggleAudio();

    if (this.socket) {
      this.socket.emit("toggle-audio", { enabled: newState });
    }
  }

  // Toggle video
  toggleVideo(): void {
    const state = useGlobalState.getState();
    const newState = !state.isVideoEnabled;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = newState;
      });
    }

    state.toggleVideo();

    if (this.socket) {
      this.socket.emit("toggle-video", { enabled: newState });
    }
  }

  // Toggle screen share
  async toggleScreenShare(): Promise<void> {
    const state = useGlobalState.getState();
    const isScreenSharing = state.isScreenSharing;

    if (!isScreenSharing) {
      try {
        const screenStream = await this.getScreenShare();

        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];

        this.peerConnections.forEach(async (peerConnection) => {
          const sender = peerConnection
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");

          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        });

        useGlobalState.getState().toggleScreenShare();

        if (this.socket) {
          this.socket.emit("start-screen-share");
        }

        // Handle screen share end
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      } catch (error) {
        console.error("Error starting screen share:", error);
      }
    } else {
      this.stopScreenShare();
    }
  }

  // Stop screen share
  private async stopScreenShare(): Promise<void> {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];

      // Replace screen share track with camera track
      this.peerConnections.forEach(async (peerConnection) => {
        const sender = peerConnection
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      });
    }

    useGlobalState.getState().toggleScreenShare();

    if (this.socket) {
      this.socket.emit("stop-screen-share");
    }
  }

  // Start collecting connection statistics
  private startStatsCollection(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(async () => {
      const stats = await this.collectConnectionStats();

      if (this.socket && stats.latency > 0) {
        this.socket.emit("stats-update", stats);
      }

      // Check for stale connections
      this.checkStaleConnections();
    }, 5000); // Update every 5 seconds
  }

  // Check for stale or failed connections
  private checkStaleConnections(): void {
    this.peerConnections.forEach((peerConnection, socketId) => {
      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "disconnected"
      ) {
        console.log(`Cleaning up stale connection for ${socketId}`);
        this.handleUserLeft(socketId);
      }

      // Check for stuck signaling states
      if (
        peerConnection.signalingState === "have-local-offer" ||
        peerConnection.signalingState === "have-remote-offer"
      ) {
        console.log(
          `Connection stuck in signaling state ${peerConnection.signalingState} for ${socketId}`
        );
        // Could implement timeout-based restart here if needed
      }
    });

    // Retry pending messages for connections that are now ready
    this.retryPendingAnswers();
    this.retryPendingOffers();
  }

  // Retry pending answers for ready connections
  private retryPendingAnswers(): void {
    this.pendingAnswers.forEach((answer, socketId) => {
      const peerConnection = this.peerConnections.get(socketId);

      if (
        peerConnection &&
        peerConnection.signalingState === "have-local-offer" &&
        !peerConnection.remoteDescription &&
        !this.processingAnswers.has(socketId)
      ) {
        console.log(`🔄 Retrying pending answer for ${socketId}`);
        this.pendingAnswers.delete(socketId);
        // Use setTimeout to avoid recursive calls
        setTimeout(() => this.handleAnswer(socketId, answer), 0);
      }
    });
  }

  // Retry pending offers for ready connections
  private retryPendingOffers(): void {
    this.pendingOffers.forEach((offer, socketId) => {
      const peerConnection = this.peerConnections.get(socketId);

      if (
        peerConnection &&
        peerConnection.signalingState === "stable" &&
        !peerConnection.remoteDescription &&
        !this.processingOffers.has(socketId)
      ) {
        console.log(`🔄 Retrying pending offer for ${socketId}`);
        this.pendingOffers.delete(socketId);
        // Use setTimeout to avoid recursive calls
        setTimeout(() => this.handleOffer(socketId, offer), 0);
      }
    });
  }

  // Collect connection statistics
  private async collectConnectionStats(): Promise<{
    latency: number;
    bandwidth: { up: number; down: number };
  }> {
    let totalLatency = 0;
    let totalBandwidthUp = 0;
    let totalBandwidthDown = 0;
    let connectionCount = 0;

    for (const [socketId, peerConnection] of this.peerConnections) {
      try {
        const stats = await peerConnection.getStats();

        stats.forEach((report) => {
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            if (report.currentRoundTripTime) {
              totalLatency += report.currentRoundTripTime * 1000; // Convert to ms
              connectionCount++;
            }
          }

          if (report.type === "outbound-rtp" && report.kind === "video") {
            if (report.bytesSent) {
              totalBandwidthUp += report.bytesSent;
            }
          }

          if (report.type === "inbound-rtp" && report.kind === "video") {
            if (report.bytesReceived) {
              totalBandwidthDown += report.bytesReceived;
            }
          }
        });
      } catch (error) {
        console.error("Error collecting stats for", socketId, error);
      }
    }

    return {
      latency: connectionCount > 0 ? totalLatency / connectionCount : 0,
      bandwidth: {
        up: totalBandwidthUp,
        down: totalBandwidthDown,
      },
    };
  }

  // Leave meeting
  leaveMeeting(): void {
    // Close all peer connections
    this.peerConnections.forEach((peerConnection) => {
      peerConnection.close();
    });
    this.peerConnections.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Clear remote streams
    this.remoteStreams.clear();

    // Clean up all pending signaling data
    this.pendingOffers.clear();
    this.pendingAnswers.clear();
    this.pendingCandidates.clear();
    this.processingAnswers.clear();
    this.processingOffers.clear();

    // Clear all processing timeouts
    this.processingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.processingTimeouts.clear();

    // Stop stats collection
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Emit leave event
    if (this.socket) {
      this.socket.emit("leave-meeting");
    }

    // Clear meeting state
    useGlobalState.getState().clearMeetingState();
  }

  // Disconnect from socket
  disconnect(): void {
    this.leaveMeeting();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Get connection quality
  getConnectionQuality(): "excellent" | "good" | "fair" | "poor" {
    const state = useGlobalState.getState();
    const connectionStats = state.connectionStats || [];

    if (connectionStats.length === 0) return "excellent";

    const avgLatency =
      connectionStats.reduce((sum, stat) => sum + stat.latency, 0) /
      connectionStats.length;

    if (avgLatency < 50) return "excellent";
    if (avgLatency < 100) return "good";
    if (avgLatency < 200) return "fair";
    return "poor";
  }
}

export const webRTCService = new WebRTCService();
