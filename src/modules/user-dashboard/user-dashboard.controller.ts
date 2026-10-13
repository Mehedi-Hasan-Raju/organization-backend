
import type { NextFunction, Request, Response } from "express";
import * as userDashboardService from "./user-dashboard.service.js";
import { UserDashboardError } from "./user-dashboard.service.js";

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

function getUserId(req: Request, res: Response): string | null {
  const userId = (req as AuthenticatedRequest).user?.id;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });

    return null;
  }

  return userId;
}

function handleError(
  error: unknown,
  next: NextFunction,
  res: Response,
) {
  if (error instanceof UserDashboardError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  next(error);
}

function getQueryNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export async function getDashboardOverviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const data = await userDashboardService.getDashboardOverview(userId);

    res.status(200).json({
      success: true,
      message: "Dashboard overview fetched successfully.",
      data,
    });
  } catch (error) {
    handleError(error, next, res);
  }
}

export async function getMyProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const data = await userDashboardService.getMyProfile(userId);

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully.",
      data,
    });
  } catch (error) {
    handleError(error, next, res);
  }
}

export async function updateMyProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const body: unknown = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      res.status(400).json({
        success: false,
        message: "Request body must be an object.",
      });
      return;
    }

    const input = body as Record<string, unknown>;
    const allowedKeys = ["name"];

    if (
      Object.keys(input).some((key) => !allowedKeys.includes(key))
    ) {
      res.status(400).json({
        success: false,
        message: "Only the name field can be updated.",
      });
      return;
    }

    if (
      input.name !== undefined &&
      typeof input.name !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Name must be a string.",
      });
      return;
    }

    const data = await userDashboardService.updateMyProfile(userId, {
      name: input.name as string | undefined,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data,
    });
  } catch (error) {
    handleError(error, next, res);
  }
}

export async function getMyApplicationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const page = getQueryNumber(req.query.page);
    const limit = getQueryNumber(req.query.limit);

    const data = await userDashboardService.getMyApplications(
      userId,
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "Your applications fetched successfully.",
      data,
    });
  } catch (error) {
    handleError(error, next, res);
  }
}

export async function getMyDashboardCoursesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const page = getQueryNumber(req.query.page);
    const limit = getQueryNumber(req.query.limit);

    const data = await userDashboardService.getMyDashboardCourses(
      userId,
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "Your courses fetched successfully.",
      data,
    });
  } catch (error) {
    handleError(error, next, res);
  }
}
