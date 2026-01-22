import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User";

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("[AUTH-MW] Authorization header:", authHeader ? "present" : "missing");

    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      console.warn("[AUTH-MW] No Bearer token provided");
      return res.status(401).json({ message: "Access token required" });
    }

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      console.log("[AUTH-MW] JWT verified for userId:", decoded.userId);
    } catch (err) {
      console.error("[AUTH-MW] JWT verification failed:", err);
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      console.error("[AUTH-MW] Token valid but user not found in DB:", decoded.userId);
      return res.status(401).json({ message: "Invalid token" });
    }

    console.log("[AUTH-MW] Authenticated user:", user._id.toString(), user.email);

    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH-MW] Unexpected auth middleware error:", error);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
