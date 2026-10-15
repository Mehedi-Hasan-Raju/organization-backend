
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CourseStatus } from "../../../generated/prisma/client.js";
import {
  CourseServiceError,
  archiveCourse,
  createCourse,
  createLesson,
  createModule,
  getAdminCourseById,
  getCourseAdminAnalytics,
  getPublicCourseBySlug,
  listAdminCourses,
  listPublicCourses,
  publishCourse,
  updateCourse,
  deleteCourse,
updateModule,
deleteModule,
reorderModules,
updateLesson,
deleteLesson,
reorderLessons,
} from "./course.service.js";

type AuthRequest = Request & {
  user: { id: string; role: string };
};

function getRequiredParam(
  req: Request,
  key: "id" | "slug" | "moduleId" | "lessonId",
) {
  const value = req.params[key];
  return typeof value === "string" ? value : undefined;
}

function handleError(
  error: unknown,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof CourseServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

function pagination(query: Request["query"]) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 10);

  if (
    !Number.isInteger(page) || page < 1 ||
    !Number.isInteger(limit) || limit < 1 || limit > 100
  ) {
    throw new CourseServiceError("Invalid page or limit.");
  }

  return { page, limit };
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  shortDescription: z.string().max(500).optional(),
  description: z.string().trim().min(10),
  thumbnailUrl: z.string().url().optional(),
  price: z.coerce.number().min(0),
  durationHours: z.coerce.number().int().min(0).optional(),
});

const updateSchema = createSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update." },
);

const moduleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().optional(),
  order: z.coerce.number().int().min(0).optional(),
});

const lessonSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().optional(),
  content: z.string().optional(),
  videoUrl: z.string().url().optional(),
  durationMinutes: z.coerce.number().int().min(0).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isPreview: z.boolean().optional(),
});

export async function getCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = pagination(req.query);
    const result = await listPublicCourses({
      page,
      limit,
      search: typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = getRequiredParam(req, "slug");

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Course slug is required.",
      });
    }

    const course = await getPublicCourseBySlug(slug);
    return res.json({ success: true, course });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function postCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createSchema.parse(req.body);
    const course = await createCourse((req as AuthRequest).user.id, data);
    return res.status(201).json({
      success: true,
      message: "Course created as draft.",
      course,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function patchCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = getRequiredParam(req, "id");

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required.",
      });
    }

    const data = updateSchema.parse(req.body);
    const course = await updateCourse(courseId, data);
    return res.json({ success: true, message: "Course updated.", course });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function publishCourseHandler(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const courseId = getRequiredParam(req, "id");

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required.",
      });
    }

    const course = await publishCourse(courseId);
    return res.json({ success: true, message: "Course published.", course });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function archiveCourseHandler(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const courseId = getRequiredParam(req, "id");

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required.",
      });
    }

    const course = await archiveCourse(courseId);
    return res.json({ success: true, message: "Course archived.", course });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getAdminCourses(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const { page, limit } = pagination(req.query);
    const rawStatus = req.query.status;
    const status = typeof rawStatus === "string" &&
      Object.values(CourseStatus).includes(rawStatus as CourseStatus)
      ? rawStatus as CourseStatus
      : undefined;

    const result = await listAdminCourses({
      page,
      limit,
      status,
      search: typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getAdminCourse(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const courseId = getRequiredParam(req, "id");

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required.",
      });
    }

    const course = await getAdminCourseById(courseId);
    return res.json({ success: true, course });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function getCourseAnalytics(
  _req: Request, res: Response, next: NextFunction,
) {
  try {
    const analytics = await getCourseAdminAnalytics();
    return res.json({ success: true, analytics });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function postModule(req: Request, res: Response, next: NextFunction) {
  try {
    const courseId = getRequiredParam(req, "id");

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required.",
      });
    }

    const data = moduleSchema.parse(req.body);
    const module = await createModule(courseId, data);
    return res.status(201).json({ success: true, module });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function postLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const moduleId = getRequiredParam(req, "moduleId");

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: "Module ID is required.",
      });
    }

    const data = lessonSchema.parse(req.body);
    const lesson = await createLesson(moduleId, data);
    return res.status(201).json({ success: true, lesson });
  } catch (error) {
    return handleError(error, res, next);
  }
}




const moduleUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  order: z.coerce.number().int().min(0).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Provide at least one field to update.",
});

const lessonUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  content: z.string().max(100000).nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(0).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isPreview: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Provide at least one field to update.",
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

export async function deleteCourseHandler(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const courseId = getRequiredParam(req, "id");

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required.",
      });
    }

    const course = await deleteCourse(courseId);
    return res.json({
      success: true,
      message:
        "Course deleted if unused; otherwise it was archived to preserve history.",
      course,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function patchModule(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const moduleId = getRequiredParam(req, "moduleId");

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: "Module ID is required.",
      });
    }

    const data = moduleUpdateSchema.parse(req.body);
    const module = await updateModule(moduleId, data);
    return res.json({ success: true, module });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function deleteModuleHandler(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const moduleId = getRequiredParam(req, "moduleId");

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: "Module ID is required.",
      });
    }

    const result = await deleteModule(moduleId);
    return res.json({
      success: true,
      message: "Module deleted.",
      ...result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function reorderModulesHandler(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const courseId = getRequiredParam(req, "id");

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required.",
      });
    }

    const { orderedIds } = reorderSchema.parse(req.body);
    const result = await reorderModules(courseId, orderedIds);
    return res.json({
      success: true,
      message: "Modules reordered.",
      ...result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function patchLesson(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const lessonId = getRequiredParam(req, "lessonId");

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: "Lesson ID is required.",
      });
    }

    const data = lessonUpdateSchema.parse(req.body);
    const lesson = await updateLesson(lessonId, data);
    return res.json({ success: true, lesson });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function deleteLessonHandler(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const lessonId = getRequiredParam(req, "lessonId");

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: "Lesson ID is required.",
      });
    }

    const result = await deleteLesson(lessonId);
    return res.json({
      success: true,
      message: "Lesson deleted.",
      ...result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function reorderLessonsHandler(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const moduleId = getRequiredParam(req, "moduleId");

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: "Module ID is required.",
      });
    }

    const { orderedIds } = reorderSchema.parse(req.body);
    const result = await reorderLessons(moduleId, orderedIds);
    return res.json({
      success: true,
      message: "Lessons reordered.",
      ...result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}
