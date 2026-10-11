
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

export type AppRole = "USER" | "MODERATOR" | "ADMIN";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: AppRole;
  };
}

function isAppRole(role: unknown): role is AppRole {
  return (
    role === "USER" ||
    role === "MODERATOR" ||
    role === "ADMIN"
  );
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
    return;
  }

  const token = authorization.slice(7).trim();
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
    return;
  }

  let decoded: string | JwtPayload;

  try {
    decoded = jwt.verify(token, secret);
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
    return;
  }

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    !isAppRole(decoded.role) ||
    typeof decoded.tokenVersion !== "number"
  ) {
    res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
    return;
  }

  try {
    const currentUser = await prisma.user.findUnique({
      where: {
        id: decoded.sub,
      },
      select: {
        id: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (
      !currentUser ||
      currentUser.status !== "ACTIVE" ||
      currentUser.tokenVersion !== decoded.tokenVersion ||
      currentUser.role !== decoded.role
    ) {
      res.status(401).json({
        success: false,
        message: "Session is invalid. Please log in again.",
      });
      return;
    }

    req.user = {
      id: currentUser.id,
      role: currentUser.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}
