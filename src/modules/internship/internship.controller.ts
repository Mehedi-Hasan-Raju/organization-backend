import type {
  Request,
  Response,
  NextFunction,
} from "express";

import type { AuthenticatedRequest } from "../../middlewares/authenticate.js";

import {
  InternshipServiceError,
  listAllPrograms,
  listPublishedPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,
  applyForProgram,
  listMyApplications,
  listApplications,
  reviewApplication,
} from "./internship.service.js";

import type {
  InternshipApplicationStatus,
} from "../../../generated/prisma/client.js";

function getId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function handleError(
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

export async function getPublishedPrograms(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await listPublishedPrograms();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getAdminPrograms(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await listAllPrograms();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getProgramDetails(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getProgram(getId(req.params.idOrSlug));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function postProgram(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await createProgram(req.body);

    return res.status(201).json({
      success: true,
      message: "Internship program created successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function patchProgram(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await updateProgram(
      getId(req.params.idOrSlug),
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Internship program updated successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function removeProgram(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await deleteProgram(
      getId(req.params.idOrSlug),
    );

    return res.status(200).json({
      success: true,
      message: "Internship program deleted successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function postApplication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user!.id;

    const data = await applyForProgram(
      userId,
      getId(req.params.idOrSlug),
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getOwnApplications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await listMyApplications(req.user!.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getAllApplications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const pageRaw = req.query.page ?? "1";
    const limitRaw = req.query.limit ?? "10";

    if (
      typeof pageRaw !== "string" ||
      !/^\d+$/.test(pageRaw) ||
      typeof limitRaw !== "string" ||
      !/^\d+$/.test(limitRaw)
    ) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers.",
      });
    }

    const page = Number(pageRaw);
    const limit = Number(limitRaw);

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be at least 1 and limit must be between 1 and 100.",
      });
    }

    const rawSearch = req.query.search;
    const rawProgramId = req.query.programId;
    const rawStatus = req.query.status;

    if (
      (rawSearch !== undefined && typeof rawSearch !== "string") ||
      (rawProgramId !== undefined && typeof rawProgramId !== "string") ||
      (rawStatus !== undefined && typeof rawStatus !== "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters.",
      });
    }

    const allowedStatuses = [
      "PENDING",
      "UNDER_REVIEW",
      "SHORTLISTED",
      "INTERVIEW",
      "SELECTED",
      "REJECTED",
      "WITHDRAWN",
    ] as const;

    if (
      typeof rawStatus === "string" &&
      !allowedStatuses.includes(
        rawStatus as (typeof allowedStatuses)[number],
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status.",
      });
    }

    const result = await listApplications({
      page,
      limit,
      ...(typeof rawSearch === "string" && rawSearch.trim()
        ? { search: rawSearch.trim() }
        : {}),
      ...(typeof rawProgramId === "string" && rawProgramId
        ? { programId: rawProgramId }
        : {}),
      ...(typeof rawStatus === "string"
        ? {
            status: rawStatus as InternshipApplicationStatus,
          }
        : {}),
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function patchApplicationReview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await reviewApplication(
      getId(req.params.applicationId),
      req.user!.id,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Application reviewed successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}