
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  addMember,
  getMemberById,
  listMembers,
  MemberServiceError,
  removeMember,
  updateMemberStatus,
} from "./member.service.js";

const addMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
  departmentId: z.string().min(1, "Department ID is required."),
  designation: z.string().trim().min(2, "Designation must be at least 2 characters.").max(100, "Designation must be at most 100 characters."),
  isSupervisor: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

function handleError(
  error: unknown,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof MemberServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

export async function getAllMembers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;
    const departmentId =
      typeof req.query.departmentId === "string"
        ? req.query.departmentId
        : undefined;
    const rawStatus =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    if (
      rawStatus &&
      rawStatus !== "ACTIVE" &&
      rawStatus !== "INACTIVE"
    ) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE.",
      });
    }

    const result = await listMembers({
      page,
      limit,
      search,
      departmentId,
      status: rawStatus as "ACTIVE" | "INACTIVE" | undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Members retrieved successfully.",
      data: result.members,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const memberId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "Member ID is required.",
      });
    }

    const member = await getMemberById(memberId);

    return res.status(200).json({
      success: true,
      message: "Member retrieved successfully.",
      data: member,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function createMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = addMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid member data.",
        errors: parsed.error.flatten(),
      });
    }

    const member = await addMember(parsed.data);

    return res.status(201).json({
      success: true,
      message: "Member added successfully.",
      data: member,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function changeMemberStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const memberId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "Member ID is required.",
      });
    }

    const parsed = updateStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE.",
        errors: parsed.error.flatten(),
      });
    }

    const member = await updateMemberStatus(
      memberId,
      parsed.data.status,
    );

    return res.status(200).json({
      success: true,
      message: "Member status updated successfully.",
      data: member,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function deleteMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const memberId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "Member ID is required.",
      });
    }

    const result = await removeMember(memberId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}
