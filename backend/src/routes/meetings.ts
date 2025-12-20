import express from "express";
import { body, validationResult } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { Meeting } from "../models/Meeting";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();

// Create new meeting
router.post(
  "/create",
  authenticateToken,
  [body("title").trim().isLength({ min: 1 })],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title } = req.body;
      const meetingId = uuidv4().substring(0, 8); // Short meeting ID

      const meeting = new Meeting({
        title,
        meetingId,
        hostId: req.user!._id,
        participants: [req.user!._id],
      });

      await meeting.save();
      await meeting.populate("hostId", "name email");

      res.status(201).json({
        message: "Meeting created successfully",
        meeting: {
          id: meeting._id,
          title: meeting.title,
          meetingId: meeting.meetingId,
          host: meeting.hostId,
          participants: meeting.participants,
          isActive: meeting.isActive,
          createdAt: meeting.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Join meeting
router.post(
  "/join/:meetingId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { meetingId } = req.params;

      const meeting = await Meeting.findOne({ meetingId, isActive: true })
        .populate("hostId", "name email")
        .populate("participants", "name email");

      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found or ended" });
      }

      // Add user to participants if not already added
      if (
        !meeting.participants.some(
          (p) => p._id.toString() === req.user!._id.toString()
        )
      ) {
        meeting.participants.push(req.user!._id as any);
        await meeting.save();
      }

      res.json({
        message: "Joined meeting successfully",
        meeting: {
          id: meeting._id,
          title: meeting.title,
          meetingId: meeting.meetingId,
          host: meeting.hostId,
          participants: meeting.participants,
          isActive: meeting.isActive,
          createdAt: meeting.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Get meeting details
router.get("/:meetingId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findOne({ meetingId })
      .populate("hostId", "name email")
      .populate("participants", "name email");

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    res.json({
      meeting: {
        id: meeting._id,
        title: meeting.title,
        meetingId: meeting.meetingId,
        host: meeting.hostId,
        participants: meeting.participants,
        isActive: meeting.isActive,
        createdAt: meeting.createdAt,
        endedAt: meeting.endedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// End meeting (only host can end)
router.post(
  "/end/:meetingId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { meetingId } = req.params;

      const meeting = await Meeting.findOne({ meetingId });

      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Check if user is the host
      if (meeting.hostId.toString() !== req.user!._id.toString()) {
        return res
          .status(403)
          .json({ message: "Only host can end the meeting" });
      }

      meeting.isActive = false;
      meeting.endedAt = new Date();
      await meeting.save();

      res.json({ message: "Meeting ended successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Get user's meetings
router.get(
  "/user/meetings",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const meetings = await Meeting.find({
        $or: [{ hostId: req.user!._id }, { participants: req.user!._id }],
      })
        .populate("hostId", "name email")
        .populate("participants", "name email")
        .sort({ createdAt: -1 });

      // Transform meetings to include id field
      const transformedMeetings = meetings.map((meeting) => ({
        id: meeting._id,
        title: meeting.title,
        meetingId: meeting.meetingId,
        host: meeting.hostId,
        participants: meeting.participants,
        isActive: meeting.isActive,
        createdAt: meeting.createdAt,
        endedAt: meeting.endedAt,
      }));

      res.json({ meetings: transformedMeetings });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  }
);

export default router;
