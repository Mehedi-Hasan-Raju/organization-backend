
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middlewares/authenticate.js";

import {
  scheduleInterview,
  updateInterview,
  cancelInterview,
} from "./interview.service.js";

import { InternshipServiceError } from "./internship.service.js";

function getRouteId(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InternshipServiceError("A valid ID is required.", 400);
  }

  return value.trim();
}

function handleControllerError(
  error: unknown,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof InternshipServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

export async function postInterview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const applicationId = getRouteId(req.params.applicationId);
    const userId = req.user?.id;

    if (!userId) {
      throw new InternshipServiceError("Authentication required.", 401);
    }

    const interview = await scheduleInterview(
      applicationId,
      userId,
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Interview scheduled. Email notification was attempted.",
      data: interview,
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function patchInterview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const interviewId = getRouteId(req.params.interviewId);
    const interview = await updateInterview(interviewId, req.body);

    return res.status(200).json({
      success: true,
      message: "Interview updated. Email notification was attempted if details changed.",
      data: interview,
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function deleteInterview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const interviewId = getRouteId(req.params.interviewId);
    const interview = await cancelInterview(interviewId);

    return res.status(200).json({
      success: true,
      message: "Interview cancelled. Email notification was attempted.",
      data: interview,
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}
