"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Video } from "lucide-react";
import { useGlobalState } from "@/state/globalState";

export default function Home() {
  const { isAuthenticated, isLoading } = useGlobalState();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        router.push("/auth");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading screen while determining auth state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <Video className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          WebRTC Meetings
        </h1>
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    </div>
  );
}
