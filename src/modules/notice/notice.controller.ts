
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { NoticeStatus } from "../../../generated/prisma/client.js";
import {
  createNotice,
  deleteNotice,
  getAdminNoticeById,
  getPublicNoticeBySlug,
  listAdminNotices,
  listPublicNotices,
  NoticeServiceError,
  publishNotice,
  unpublishNotice,
  updateNotice,
} from "./notice.service.js";

const createNoticeSchema = z.object({
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10).max(50000),
});

const updateNoticeSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(10).max(50000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Provide at least one field to update.",
});

function handleError(
  error: unknown,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof NoticeServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

function parsePagination(req: Request) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return null;
  }

  return { page, limit };
}

// Public: GET /api/v1/notices
export async function getPublicNotices(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const pagination = parsePagination(req);

    if (!pagination) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;

    const result = await listPublicNotices({
      ...pagination,
      search,
    });

    return res.status(200).json({
      success: true,
      message: "Published notices retrieved successfully.",
      data: result.notices,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Public: GET /api/v1/notices/:slug
export async function getPublicNotice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const slug = typeof req.params.slug === "string" ? req.params.slug : undefined;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Notice slug is required.",
      });
    }

    const notice = await getPublicNoticeBySlug(slug);

    return res.status(200).json({
      success: true,
      message: "Notice retrieved successfully.",
      data: notice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Admin: GET /api/v1/notices/admin
export async function getAllAdminNotices(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const pagination = parsePagination(req);

    if (!pagination) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;

    const rawStatus =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    if (
      rawStatus &&
      rawStatus !== NoticeStatus.DRAFT &&
      rawStatus !== NoticeStatus.PUBLISHED
    ) {
      return res.status(400).json({
        success: false,
        message: "Status must be DRAFT or PUBLISHED.",
      });
    }

    const result = await listAdminNotices({
      ...pagination,
      search,
      status: rawStatus as NoticeStatus | undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Admin notices retrieved successfully.",
      data: result.notices,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Admin: GET /api/v1/notices/admin/:id
export async function getAdminNotice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const noticeId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!noticeId) {
      return res.status(400).json({
        success: false,
        message: "Notice ID is required.",
      });
    }

    const notice = await getAdminNoticeById(noticeId);

    return res.status(200).json({
      success: true,
      message: "Notice retrieved successfully.",
      data: notice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Admin: POST /api/v1/notices
export async function postNotice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createNoticeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid notice data.",
        errors: parsed.error.flatten(),
      });
    }

    const notice = await createNotice(parsed.data);

    return res.status(201).json({
      success: true,
      message: "Notice created as draft successfully.",
      data: notice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Admin: PATCH /api/v1/notices/:id
export async function patchNotice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const noticeId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!noticeId) {
      return res.status(400).json({
        success: false,
        message: "Notice ID is required.",
      });
    }

    const parsed = updateNoticeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid notice update data.",
        errors: parsed.error.flatten(),
      });
    }

    const notice = await updateNotice(noticeId, parsed.data);

    return res.status(200).json({
      success: true,
      message: "Notice updated successfully.",
      data: notice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Admin: PATCH /api/v1/notices/:id/publish
export async function publishNoticeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const noticeId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!noticeId) {
      return res.status(400).json({
        success: false,
        message: "Notice ID is required.",
      });
    }

    const notice = await publishNotice(noticeId);

    return res.status(200).json({
      success: true,
      message: "Notice published successfully.",
      data: notice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Admin: PATCH /api/v1/notices/:id/unpublish
export async function unpublishNoticeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const noticeId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!noticeId) {
      return res.status(400).json({
        success: false,
        message: "Notice ID is required.",
      });
    }

    const notice = await unpublishNotice(noticeId);

    return res.status(200).json({
      success: true,
      message: "Notice moved to draft successfully.",
      data: notice,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

// Admin: DELETE /api/v1/notices/:id
export async function deleteNoticeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const noticeId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!noticeId) {
      return res.status(400).json({
        success: false,
        message: "Notice ID is required.",
      });
    }

    const result = await deleteNotice(noticeId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}
