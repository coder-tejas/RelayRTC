"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar";
import {
  Video,
  Plus,
  LogOut,
  Users,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { useGlobalState, Meeting } from "@/state/globalState";
import { meetingAPI } from "@/api/api";

const createMeetingSchema = z.object({
  title: z.string().min(1, "Meeting title is required"),
});

const joinMeetingSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
});

type CreateMeetingForm = z.infer<typeof createMeetingSchema>;
type JoinMeetingForm = z.infer<typeof joinMeetingSchema>;

export default function Dashboard() {
  const { user, logout, isAuthenticated, hasHydrated } = useGlobalState();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const router = useRouter();

  const createForm = useForm<CreateMeetingForm>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: { title: "" },
  });

  const joinForm = useForm<JoinMeetingForm>({
    resolver: zodResolver(joinMeetingSchema),
    defaultValues: { meetingId: "" },
  });

  useEffect(() => {
    // Wait for hydration before checking authentication
    if (!hasHydrated) {
      return;
    }

    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }

    loadMeetings();
  }, [isAuthenticated, hasHydrated, router]);

  const loadMeetings = async () => {
    try {
      setIsLoadingMeetings(true);
      const response = await meetingAPI.getUserMeetings();
      setMeetings(response.data.meetings);
    } catch (error: any) {
      toast.error("Failed to load meetings");
    } finally {
      setIsLoadingMeetings(false);
    }
  };

  const onCreateMeeting = async (data: CreateMeetingForm) => {
    try {
      setIsLoading(true);
      const response = await meetingAPI.create(data);
      const { meeting } = response.data;

      setMeetings((prev) => [meeting, ...prev]);
      setIsCreateDialogOpen(false);
      createForm.reset();

      toast.success("Meeting created successfully!");

      // Redirect to meeting room
      router.push(`/meeting/${meeting.meetingId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create meeting");
    } finally {
      setIsLoading(false);
    }
  };

  const onJoinMeeting = async (data: JoinMeetingForm) => {
    try {
      setIsLoading(true);
      await meetingAPI.join(data.meetingId);

      setIsJoinDialogOpen(false);
      joinForm.reset();

      toast.success("Joining meeting...");
      router.push(`/meeting/${data.meetingId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to join meeting");
    } finally {
      setIsLoading(false);
    }
  };

  const copyMeetingLink = (meetingId: string) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied to clipboard!");
  };

  const handleLogout = () => {
    logout();
    router.push("/auth");
  };

  // Show loading while waiting for authentication state to hydrate
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Video className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                WebRTC Meetings
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700">
                  {user.name}
                </span>
              </div>

              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <Plus className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Create Meeting
                    </h3>
                    <p className="text-gray-600">
                      Start a new video conference
                    </p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Meeting</DialogTitle>
                <DialogDescription>
                  Enter a title for your meeting and start your video
                  conference.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={createForm.handleSubmit(onCreateMeeting)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Meeting Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter meeting title"
                    {...createForm.register("title")}
                  />
                  {createForm.formState.errors.title && (
                    <p className="text-sm text-red-500">
                      {createForm.formState.errors.title.message}
                    </p>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Meeting
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <ExternalLink className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Join Meeting
                    </h3>
                    <p className="text-gray-600">
                      Join an existing video conference
                    </p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Meeting</DialogTitle>
                <DialogDescription>
                  Enter the meeting ID to join an existing video conference.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={joinForm.handleSubmit(onJoinMeeting)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="meetingId">Meeting ID</Label>
                  <Input
                    id="meetingId"
                    placeholder="Enter meeting ID"
                    {...joinForm.register("meetingId")}
                  />
                  {joinForm.formState.errors.meetingId && (
                    <p className="text-sm text-red-500">
                      {joinForm.formState.errors.meetingId.message}
                    </p>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsJoinDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Join Meeting
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Meeting History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Your Meetings</span>
            </CardTitle>
            <CardDescription>
              View and manage your recent meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMeetings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-8">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No meetings yet
                </h3>
                <p className="text-gray-600">
                  Create your first meeting to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {meetings.map((meeting, index) => (
                  <div key={`${meeting.meetingId}-${index}`}>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900">
                            {meeting.title}
                          </h4>
                          <Badge
                            variant={meeting.isActive ? "default" : "secondary"}
                          >
                            {meeting.isActive ? "Active" : "Ended"}
                          </Badge>
                        </div>

                        <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {format(
                                new Date(meeting.createdAt),
                                "MMM dd, yyyy HH:mm"
                              )}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {meeting.participants.length} participants
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                              {meeting.meetingId}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyMeetingLink(meeting.meetingId)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>

                        {meeting.isActive && (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(`/meeting/${meeting.meetingId}`)
                            }
                          >
                            <Video className="h-4 w-4 mr-2" />
                            Join
                          </Button>
                        )}
                      </div>
                    </div>

                    {index < meetings.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
