import express from "express";
import { body, validationResult } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { Meeting } from "../models/Meeting";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();

/* ===================== CREATE MEETING ===================== */
router.post(
  "/create",
  authenticateToken,
  [body("title").trim().isLength({ min: 1 })],
  async (req: AuthRequest, res) => {
    console.log(`[MEETING] Create request by user ${req.user?._id}`);

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.warn("[MEETING] Validation failed:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { title } = req.body;
      const meetingId = uuidv4().substring(0, 8);

      console.log(`[MEETING] Creating meeting "${title}" with id ${meetingId}`);

      const meeting = new Meeting({
        title,
        meetingId,
        hostId: req.user!._id,
        participants: [req.user!._id],
      });

      await meeting.save();
      await meeting.populate("hostId", "name email");

      console.log(`[MEETING] Created ${meetingId} by ${req.user!._id}`);

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
      console.error("[MEETING] Create failed:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

/* ===================== JOIN MEETING ===================== */
router.post(
  "/join/:meetingId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const { meetingId } = req.params;
    console.log(`[MEETING] User ${req.user?._id} joining ${meetingId}`);

    try {
      const meeting = await Meeting.findOne({ meetingId, isActive: true })
        .populate("hostId", "name email")
        .populate("participants", "name email");

      if (!meeting) {
        console.warn(`[MEETING] Join failed. Not found: ${meetingId}`);
        return res.status(404).json({ message: "Meeting not found or ended" });
      }

      const alreadyJoined = meeting.participants.some(
        (p) => p._id.toString() === req.user!._id.toString()
      );

      if (!alreadyJoined) {
        meeting.participants.push(req.user!._id as any);
        await meeting.save();
        console.log(`[MEETING] User ${req.user!._id} added to ${meetingId}`);
      } else {
        console.log(`[MEETING] User ${req.user!._id} already in ${meetingId}`);
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
      console.error(`[MEETING] Join failed for ${meetingId}:`, error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

/* ===================== GET MEETING ===================== */
router.get("/:meetingId", authenticateToken, async (req: AuthRequest, res) => {
  const { meetingId } = req.params;
  console.log(`[MEETING] Fetch details for ${meetingId}`);

  try {
    const meeting = await Meeting.findOne({ meetingId })
      .populate("hostId", "name email")
      .populate("participants", "name email");

    if (!meeting) {
      console.warn(`[MEETING] Not found: ${meetingId}`);
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
    console.error(`[MEETING] Fetch failed for ${meetingId}:`, error);
    res.status(500).json({ message: "Server error", error });
  }
});

/* ===================== END MEETING ===================== */
router.post(
  "/end/:meetingId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const { meetingId } = req.params;
    console.log(`[MEETING] End request for ${meetingId} by ${req.user?._id}`);

    try {
      const meeting = await Meeting.findOne({ meetingId });

      if (!meeting) {
        console.warn(`[MEETING] End failed. Not found: ${meetingId}`);
        return res.status(404).json({ message: "Meeting not found" });
      }

      if (meeting.hostId.toString() !== req.user!._id.toString()) {
        console.warn(`[MEETING] Unauthorized end attempt by ${req.user!._id}`);
        return res.status(403).json({ message: "Only host can end the meeting" });
      }

      meeting.isActive = false;
      meeting.endedAt = new Date();
      await meeting.save();

      console.log(`[MEETING] ${meetingId} ended by host ${req.user!._id}`);

      res.json({ message: "Meeting ended successfully" });
    } catch (error) {
      console.error(`[MEETING] End failed for ${meetingId}:`, error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

/* ===================== USER MEETINGS ===================== */
router.get(
  "/user/meetings",
  authenticateToken,
  async (req: AuthRequest, res) => {
    console.log(`[MEETING] Fetch meetings for user ${req.user?._id}`);

    try {
      const meetings = await Meeting.find({
        $or: [{ hostId: req.user!._id }, { participants: req.user!._id }],
      })
        .populate("hostId", "name email")
        .populate("participants", "name email")
        .sort({ createdAt: -1 });

      console.log(`[MEETING] Found ${meetings.length} meetings for ${req.user?._id}`);

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
      console.error("[MEETING] User meetings fetch failed:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

export default router;
