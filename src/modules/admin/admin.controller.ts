
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middlewares/authenticate.js";
import {
  AdminServiceError,
  createUser,
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
} from "./admin.service.js";
import type {
  UserRole,
  UserStatus,
} from "../../../generated/prisma/client.js";

function handleError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof AdminServiceError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  next(error);
}

function getActorId(req: AuthenticatedRequest): string | null {
  return req.user?.id ?? null;
}

function getParamId(req: AuthenticatedRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] ?? "" : id ?? "";
}

export async function createAdminManagedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await createUser({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role as UserRole,
    });

    res.status(201).json({
      success: true,
      message:
        "User created. Email verification is required before login.",
      data: { user },
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function adminDashboard(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await getDashboardStats();

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function listUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pageValue = req.query.page;
    const limitValue = req.query.limit;
    const searchValue = req.query.search;
    const roleValue = req.query.role;
    const statusValue = req.query.status;

    const page = pageValue === undefined ? 1 : Number(pageValue);
    const limit = limitValue === undefined ? 10 : Number(limitValue);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      res.status(400).json({
        success: false,
        message: "page must be positive; limit must be between 1 and 100",
      });
      return;
    }

    if (
      (searchValue !== undefined && typeof searchValue !== "string") ||
      (roleValue !== undefined && typeof roleValue !== "string") ||
      (statusValue !== undefined && typeof statusValue !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
      });
      return;
    }

    const validRoles = ["USER", "MODERATOR", "ADMIN"];
    const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"];

    if (roleValue !== undefined && !validRoles.includes(roleValue)) {
      res.status(400).json({
        success: false,
        message: "Invalid role filter",
      });
      return;
    }

    if (
      statusValue !== undefined &&
      !validStatuses.includes(statusValue)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid status filter",
      });
      return;
    }

    const result = await getUsers({
      page,
      limit,
      ...(typeof searchValue === "string" && searchValue.trim()
        ? { search: searchValue.trim() }
        : {}),
      ...(typeof roleValue === "string"
        ? { role: roleValue as UserRole }
        : {}),
      ...(typeof statusValue === "string"
        ? { status: statusValue as UserStatus }
        : {}),
    });

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function getUserDetails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await getUserById(getParamId(req));

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: { user },
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function changeUserRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const actorId = getActorId(req);

  if (!actorId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  try {
    const user = await updateUserRole(
      getParamId(req),
      req.body.role as UserRole,
      actorId
    );

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: { user },
    });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function changeUserStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const actorId = getActorId(req);

  if (!actorId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  try {
    const user = await updateUserStatus(
      getParamId(req),
      req.body.status as UserStatus,
      actorId
    );

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: { user },
    });
  } catch (error) {
    handleError(error, res, next);
  }
}
