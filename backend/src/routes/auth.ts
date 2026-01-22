import express from "express";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { User } from "../models/User";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();

/* ===================== REGISTER ===================== */
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").trim().isLength({ min: 1 }),
  ],
  async (req, res) => {
    console.log("[AUTH] Register request:", req.body.email);

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.warn("[AUTH] Register validation failed:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.warn("[AUTH] Register failed, user exists:", email);
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const user = new User({ email, password, name });
      await user.save();
      console.log("[AUTH] User created:", user._id.toString());

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });

      console.log("[AUTH] JWT issued for:", user._id.toString());

      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("[AUTH] Register error:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

/* ===================== LOGIN ===================== */
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").exists()],
  async (req, res) => {
    console.log("[AUTH] Login attempt:", req.body.email);

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.warn("[AUTH] Login validation failed:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        console.warn("[AUTH] Login failed, user not found:", email);
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.warn("[AUTH] Login failed, wrong password for:", email);
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });

      console.log("[AUTH] Login success, JWT issued for:", user._id.toString());

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("[AUTH] Login error:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

/* ===================== CURRENT USER ===================== */
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  console.log("[AUTH] /me requested by:", req.user?._id);

  try {
    res.json({
      user: {
        id: req.user!._id,
        email: req.user!.email,
        name: req.user!.name,
      },
    });
  } catch (error) {
    console.error("[AUTH] /me error:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;
