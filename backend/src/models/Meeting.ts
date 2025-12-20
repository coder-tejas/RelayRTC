import mongoose, { Document, Schema } from "mongoose";

export interface IMeeting extends Document {
  title: string;
  meetingId: string;
  hostId: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  endedAt?: Date;
  maxParticipants: number;
}

const meetingSchema = new Schema<IMeeting>({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  meetingId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
  },
  maxParticipants: {
    type: Number,
    default: 50,
  },
});

export const Meeting = mongoose.model<IMeeting>("Meeting", meetingSchema);
