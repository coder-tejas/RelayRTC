"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Phone,
  PhoneOff,
  Users,
  Settings,
  Wifi,
  WifiOff,
  Activity,
  Clock,
  Upload,
  Download,
} from "lucide-react";

import { useGlobalState, Participant } from "@/state/globalState";
import { webRTCService } from "@/services/webRTCService";
import { meetingAPI } from "@/api/api";

interface VideoComponentProps {
  stream?: MediaStream;
  participant?: Participant;
  isLocal?: boolean;
  isMuted?: boolean;
}

const VideoComponent: React.FC<VideoComponentProps> = ({
  stream,
  participant,
  isLocal = false,
  isMuted = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const getInitials = () => {
    if (participant?.name) {
      return participant.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    }
    return "U";
  };

  return (
    <Card className="relative overflow-hidden bg-gray-900">
      <CardContent className="p-0 aspect-video">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted || isLocal}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Overlay with participant info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">
                {isLocal ? "You" : participant?.name || "Unknown"}
              </span>
              {isLocal && (
                <Badge variant="secondary" className="text-xs">
                  Host
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-1">
              {participant?.isAudioEnabled === false && (
                <MicOff className="h-4 w-4" />
              )}
              {participant?.isVideoEnabled === false && (
                <VideoOff className="h-4 w-4" />
              )}
              {participant?.isScreenSharing && <Monitor className="h-4 w-4" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function MeetingRoom() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.meetingId as string;

  const {
    user,
    token,
    isAuthenticated,
    hasHydrated,
    currentMeeting,
    participants,
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    connectionStats,
    isHost,
    setCurrentMeeting,
  } = useGlobalState();

  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<
    "excellent" | "good" | "fair" | "poor"
  >("excellent");
  const [showStats, setShowStats] = useState(false);
  const [avgLatency, setAvgLatency] = useState(0);
  const [totalBandwidth, setTotalBandwidth] = useState({ up: 0, down: 0 });

  useEffect(() => {
    // Wait for hydration before checking authentication
    if (!hasHydrated) {
      return;
    }

    // Only redirect to auth if we're sure the user is not authenticated
    if (!isAuthenticated || !token) {
      router.push("/auth");
      return;
    }

    initializeMeeting();

    return () => {
      webRTCService.leaveMeeting();
    };
  }, [isAuthenticated, hasHydrated, token, meetingId, router]);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthLogout = () => {
      toast.error("Session expired. Please login again.");
      router.push("/auth");
    };

    window.addEventListener("auth-logout", handleAuthLogout);

    return () => {
      window.removeEventListener("auth-logout", handleAuthLogout);
    };
  }, [router]);

  useEffect(() => {
    // Update connection quality and stats
    const quality = webRTCService.getConnectionQuality();
    setConnectionQuality(quality);

    if (connectionStats.length > 0) {
      const avgLat =
        connectionStats.reduce((sum, stat) => sum + stat.latency, 0) /
        connectionStats.length;
      const totalUp = connectionStats.reduce(
        (sum, stat) => sum + stat.bandwidth.up,
        0
      );
      const totalDown = connectionStats.reduce(
        (sum, stat) => sum + stat.bandwidth.down,
        0
      );

      setAvgLatency(avgLat);
      setTotalBandwidth({ up: totalUp, down: totalDown });
    }
  }, [connectionStats]);

  const initializeMeeting = async () => {
    try {
      setIsConnecting(true);

      // Join meeting via API
      const response = await meetingAPI.join(meetingId);
      setCurrentMeeting(response.data.meeting);

      // Connect to WebRTC service
      await webRTCService.connect(token!);

      // Get user media
      await webRTCService.getUserMedia(true, true);

      // Join meeting room
      await webRTCService.joinMeeting(meetingId);

      toast.success("Successfully joined the meeting!");
    } catch (error: any) {
      console.error("Meeting initialization error:", error);

      // Check if it's an auth error
      if (error.response?.status === 401) {
        toast.error("Authentication failed. Please login again.");
        router.push("/auth");
      } else {
        toast.error(error.response?.data?.message || "Failed to join meeting");
        router.push("/dashboard");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleToggleAudio = () => {
    webRTCService.toggleAudio();
  };

  const handleToggleVideo = () => {
    webRTCService.toggleVideo();
  };

  const handleToggleScreenShare = async () => {
    try {
      await webRTCService.toggleScreenShare();
    } catch (error) {
      toast.error("Failed to toggle screen share");
    }
  };

  const handleLeaveMeeting = () => {
    webRTCService.leaveMeeting();
    router.push("/dashboard");
  };

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case "excellent":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "good":
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case "fair":
        return <Wifi className="h-4 w-4 text-yellow-500" />;
      case "poor":
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const getConnectionColor = () => {
    switch (connectionQuality) {
      case "excellent":
        return "text-green-500";
      case "good":
        return "text-blue-500";
      case "fair":
        return "text-yellow-500";
      case "poor":
        return "text-red-500";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Show loading while waiting for authentication state to hydrate
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <Video className="h-16 w-16 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold mb-2">Joining Meeting...</h2>
          <p className="text-gray-400">Please wait while we connect you</p>
        </div>
      </div>
    );
  }

  const participantArray = Array.from(participants.values());
  const totalParticipants = participantArray.length + 1; // +1 for local user

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">
              {currentMeeting?.title || "Meeting"}
            </h1>
            <Badge variant="secondary">{currentMeeting?.meetingId}</Badge>
          </div>

          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {getConnectionIcon()}
              <span className={`text-sm ${getConnectionColor()}`}>
                {connectionQuality}
              </span>
            </div>

            {/* Participants Count */}
            <div className="flex items-center space-x-2 text-gray-300">
              <Users className="h-4 w-4" />
              <span className="text-sm">{totalParticipants}</span>
            </div>

            {/* Stats Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="text-gray-300 hover:text-white"
            >
              <Activity className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Connection Stats */}
        {showStats && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>Latency: {Math.round(avgLatency)}ms</span>
            </div>
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4 text-green-400" />
              <span>Up: {formatBytes(totalBandwidth.up)}/s</span>
            </div>
            <div className="flex items-center space-x-2">
              <Download className="h-4 w-4 text-purple-400" />
              <span>Down: {formatBytes(totalBandwidth.down)}/s</span>
            </div>
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4 text-gray-400" />
              <span>Quality: {connectionQuality}</span>
            </div>
          </div>
        )}
      </header>

      {/* Video Grid */}
      <main className="flex-1 p-6">
        <div
          className={`grid gap-4 h-full ${
            totalParticipants === 1
              ? "grid-cols-1"
              : totalParticipants === 2
              ? "grid-cols-2"
              : totalParticipants <= 4
              ? "grid-cols-2 grid-rows-2"
              : totalParticipants <= 6
              ? "grid-cols-3 grid-rows-2"
              : "grid-cols-4 grid-rows-2"
          }`}
        >
          {/* Local Video */}
          <VideoComponent
            stream={localStream || undefined}
            participant={{
              id: user?.id || "",
              name: user?.name || "",
              email: user?.email || "",
              socketId: "local",
              isAudioEnabled: isAudioEnabled,
              isVideoEnabled: isVideoEnabled,
              isScreenSharing: isScreenSharing,
            }}
            isLocal={true}
            isMuted={true}
          />

          {/* Remote Videos */}
          {participantArray.map((participant) => (
            <VideoComponent
              key={participant.socketId}
              stream={participant.stream}
              participant={participant}
            />
          ))}
        </div>
      </main>

      {/* Controls */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant={isAudioEnabled ? "default" : "destructive"}
            size="lg"
            onClick={handleToggleAudio}
            className="rounded-full w-12 h-12"
          >
            {isAudioEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant={isVideoEnabled ? "default" : "destructive"}
            size="lg"
            onClick={handleToggleVideo}
            className="rounded-full w-12 h-12"
          >
            {isVideoEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant={isScreenSharing ? "secondary" : "outline"}
            size="lg"
            onClick={handleToggleScreenShare}
            className="rounded-full w-12 h-12"
          >
            {isScreenSharing ? (
              <MonitorOff className="h-5 w-5" />
            ) : (
              <Monitor className="h-5 w-5" />
            )}
          </Button>

          <Separator orientation="vertical" className="h-8" />

          <Button
            variant="destructive"
            size="lg"
            onClick={handleLeaveMeeting}
            className="rounded-full w-12 h-12"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
