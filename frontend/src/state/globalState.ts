import { create } from "zustand";
import { persist } from "zustand/middleware";

// Types
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Meeting {
  id: string;
  title: string;
  meetingId: string;
  host: User;
  participants: User[];
  isActive: boolean;
  createdAt: string;
  endedAt?: string;
}

export interface ConnectionStats {
  socketId: string;
  userId: string;
  joinedAt: Date;
  latency: number;
  bandwidth: {
    up: number;
    down: number;
  };
}

export interface Participant extends User {
  socketId: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
  connectionStats?: ConnectionStats;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  setIsLoading: (isLoading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

interface MeetingState {
  currentMeeting: Meeting | null;
  participants: Map<string, Participant>;
  localStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  connectionStats: ConnectionStats[];
  isHost: boolean;

  // Actions
  setCurrentMeeting: (meeting: Meeting | null) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (socketId: string) => void;
  updateParticipant: (socketId: string, updates: Partial<Participant>) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  setConnectionStats: (stats: ConnectionStats[]) => void;
  setIsHost: (isHost: boolean) => void;
  clearMeetingState: () => void;
}

type GlobalState = AuthState & MeetingState;

export const useGlobalState = create<GlobalState>()(
  persist(
    (set, get) => ({
      // Auth state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,

      // Meeting state
      currentMeeting: null,
      participants: new Map(),
      localStream: null,
      isAudioEnabled: true,
      isVideoEnabled: true,
      isScreenSharing: false,
      connectionStats: [],
      isHost: false,

      // Auth actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          currentMeeting: null,
          participants: new Map(),
          localStream: null,
          isAudioEnabled: true,
          isVideoEnabled: true,
          isScreenSharing: false,
          connectionStats: [],
          isHost: false,
        }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      // Meeting actions
      setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),

      addParticipant: (participant) =>
        set((state) => {
          const newParticipants = new Map(state.participants);
          newParticipants.set(participant.socketId, participant);
          return { participants: newParticipants };
        }),

      removeParticipant: (socketId) =>
        set((state) => {
          const newParticipants = new Map(state.participants);
          newParticipants.delete(socketId);
          return { participants: newParticipants };
        }),

      updateParticipant: (socketId, updates) =>
        set((state) => {
          const newParticipants = new Map(state.participants);
          const existing = newParticipants.get(socketId);
          if (existing) {
            newParticipants.set(socketId, { ...existing, ...updates });
          }
          return { participants: newParticipants };
        }),

      setLocalStream: (stream) => set({ localStream: stream }),

      toggleAudio: () =>
        set((state) => {
          const newState = !state.isAudioEnabled;
          if (state.localStream) {
            state.localStream.getAudioTracks().forEach((track) => {
              track.enabled = newState;
            });
          }
          return { isAudioEnabled: newState };
        }),

      toggleVideo: () =>
        set((state) => {
          const newState = !state.isVideoEnabled;
          if (state.localStream) {
            state.localStream.getVideoTracks().forEach((track) => {
              track.enabled = newState;
            });
          }
          return { isVideoEnabled: newState };
        }),

      toggleScreenShare: () =>
        set((state) => ({ isScreenSharing: !state.isScreenSharing })),

      setConnectionStats: (stats) => set({ connectionStats: stats }),

      setIsHost: (isHost) => set({ isHost }),

      clearMeetingState: () =>
        set({
          currentMeeting: null,
          participants: new Map(),
          localStream: null,
          isAudioEnabled: true,
          isVideoEnabled: true,
          isScreenSharing: false,
          connectionStats: [],
          isHost: false,
        }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Set up auth logout event listener
if (typeof window !== "undefined") {
  window.addEventListener("auth-logout", () => {
    useGlobalState.getState().logout();
  });
}
