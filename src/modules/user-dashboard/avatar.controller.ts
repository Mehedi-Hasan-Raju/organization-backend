
import type { NextFunction, Request, Response } from "express";
import * as avatarService from "./avatar.service.js";
import { UserDashboardError } from "./user-dashboard.service.js";

type AuthenticatedRequest = Request & {
  user?: { id?: string };
  file?: Express.Multer.File;
};

export async function uploadMyAvatarHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = req as AuthenticatedRequest;
    const userId = request.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!request.file) {
      res.status(400).json({
        success: false,
        message: 'Image is required in form-data field "file".',
      });
      return;
    }

    const data = await avatarService.updateMyAvatar(
      userId,
      request.file,
    );

    res.status(200).json({
      success: true,
      message: "Avatar updated successfully.",
      data,
    });
  } catch (error) {
    if (error instanceof UserDashboardError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function removeMyAvatarHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const data = await avatarService.removeMyAvatar(userId);

    res.status(200).json({
      success: true,
      message: "Avatar removed successfully.",
      data,
    });
  } catch (error) {
    if (error instanceof UserDashboardError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}
