
import { randomBytes } from "node:crypto";
import { Prisma, CourseStatus } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export class CourseServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "CourseServiceError";
  }
}

function createSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `course-${randomBytes(4).toString("hex")}`;
}

async function uniqueSlug(title: string, excludeId?: string) {
  const base = createSlug(title);
  let slug = base;
  let count = 1;

  while (
    await prisma.course.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })
  ) {
    slug = `${base}-${++count}`;
  }

  return slug;
}

export async function createCourse(
  createdById: string,
  data: {
    title: string;
    shortDescription?: string;
    description: string;
    thumbnailUrl?: string;
    price: number;
    durationHours?: number;
  },
) {
  if (data.price < 0) {
    throw new CourseServiceError("Price cannot be negative.");
  }

  return prisma.course.create({
    data: {
      ...data,
      slug: await uniqueSlug(data.title),
      createdById,
      status: CourseStatus.DRAFT,
    },
  });
}

export async function updateCourse(
  id: string,
  data: {
    title?: string;
    shortDescription?: string | null;
    description?: string;
    thumbnailUrl?: string | null;
    price?: number;
    durationHours?: number;
  },
) {
  const course = await prisma.course.findUnique({ where: { id } });

  if (!course) {
    throw new CourseServiceError("Course not found.", 404);
  }

  if (data.price !== undefined && data.price < 0) {
    throw new CourseServiceError("Price cannot be negative.");
  }

  return prisma.course.update({
    where: { id },
    data: {
      ...data,
      ...(data.title && data.title !== course.title
        ? { slug: await uniqueSlug(data.title, id) }
        : {}),
    },
  });
}

export async function publishCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { modules: { include: { lessons: true } } },
  });

  if (!course) {
    throw new CourseServiceError("Course not found.", 404);
  }

  if (course.modules.length === 0 ||
      course.modules.every((module) => module.lessons.length === 0)) {
    throw new CourseServiceError(
      "Add at least one module and lesson before publishing.",
    );
  }

  return prisma.course.update({
    where: { id },
    data: {
      status: CourseStatus.PUBLISHED,
      publishedAt: course.publishedAt ?? new Date(),
    },
  });
}

export async function archiveCourse(id: string) {
  const course = await prisma.course.findUnique({ where: { id } });

  if (!course) {
    throw new CourseServiceError("Course not found.", 404);
  }

  return prisma.course.update({
    where: { id },
    data: { status: CourseStatus.ARCHIVED },
  });
}

export async function listPublicCourses(options: {
  page: number;
  limit: number;
  search?: string;
}) {
  const { page, limit, search } = options;

  const where: Prisma.CourseWhereInput = {
    status: CourseStatus.PUBLISHED,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            {
              shortDescription: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [courses, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { publishedAt: "desc" },
      include: {
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return {
    courses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPublicCourseBySlug(slug: string) {
  const course = await prisma.course.findFirst({
    where: { slug, status: CourseStatus.PUBLISHED },
    include: {
      modules: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              durationMinutes: true,
              order: true,
              isPreview: true,
            },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) {
    throw new CourseServiceError("Course not found.", 404);
  }

  return course;
}

export async function listAdminCourses(options: {
  page: number;
  limit: number;
  search?: string;
  status?: CourseStatus;
}) {
  const { page, limit, search, status } = options;

  const where: Prisma.CourseWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [courses, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true, payments: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return {
    courses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createModule(
  courseId: string,
  data: { title: string; description?: string; order?: number },
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course) throw new CourseServiceError("Course not found.", 404);

  if (course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  return prisma.courseModule.create({
    data: { courseId, ...data },
  });
}

export async function createLesson(
  moduleId: string,
  data: {
    title: string;
    description?: string;
    content?: string;
    videoUrl?: string;
    durationMinutes?: number;
    order?: number;
    isPreview?: boolean;
  },
) {
  const module = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    include: { course: true },
  });

  if (!module) throw new CourseServiceError("Module not found.", 404);

  if (module.course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  return prisma.courseLesson.create({
    data: { moduleId, ...data },
  });
}

export async function getCourseAdminAnalytics() {
  const [
    totalCourses,
    publishedCourses,
    totalEnrollments,
    completedEnrollments,
    successfulPayments,
  ] = await Promise.all([
    prisma.course.count(),
    prisma.course.count({ where: { status: CourseStatus.PUBLISHED } }),
    prisma.courseEnrollment.count(),
    prisma.courseEnrollment.count({ where: { status: "COMPLETED" } }),
    prisma.coursePayment.findMany({
      where: { status: "SUCCESS" },
      select: { amount: true },
    }),
  ]);

  const revenue = successfulPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      price: true,
      _count: { select: { enrollments: true } },
    },
  });

  return {
    totalCourses,
    publishedCourses,
    totalEnrollments,
    completedEnrollments,
    revenue,
    courses: courses.map((course) => ({
      ...course,
      price: Number(course.price),
      enrollmentCount: course._count.enrollments,
    })),
  };
}



export async function deleteCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          enrollments: true,
          payments: true,
        },
      },
    },
  });

  if (!course) {
    throw new CourseServiceError("Course not found.", 404);
  }

  // Preserve financial and enrollment history.
  if (course._count.enrollments > 0 || course._count.payments > 0) {
    return prisma.course.update({
      where: { id },
      data: { status: CourseStatus.ARCHIVED },
    });
  }

  return prisma.course.delete({ where: { id } });
}

export async function updateModule(
  moduleId: string,
  data: {
    title?: string;
    description?: string | null;
    order?: number;
  },
) {
  const module = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    include: { course: { select: { status: true } } },
  });

  if (!module) {
    throw new CourseServiceError("Module not found.", 404);
  }

  if (module.course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  return prisma.courseModule.update({
    where: { id: moduleId },
    data,
  });
}

export async function deleteModule(moduleId: string) {
  const module = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    include: {
      course: { select: { status: true } },
      lessons: {
        select: {
          id: true,
          _count: { select: { progresses: true } },
        },
      },
    },
  });

  if (!module) {
    throw new CourseServiceError("Module not found.", 404);
  }

  if (module.course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  if (module.lessons.some((lesson) => lesson._count.progresses > 0)) {
    throw new CourseServiceError(
      "This module contains lessons with learner progress. It cannot be deleted.",
      409,
    );
  }

  await prisma.courseModule.delete({ where: { id: moduleId } });

  return { deleted: true, moduleId };
}

export async function reorderModules(
  courseId: string,
  orderedIds: string[],
) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true },
  });

  if (!course) {
    throw new CourseServiceError("Course not found.", 404);
  }

  if (course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new CourseServiceError("Duplicate module IDs are not allowed.");
  }

  const modules = await prisma.courseModule.findMany({
    where: { courseId },
    select: { id: true },
  });

  if (
    modules.length !== orderedIds.length ||
    !modules.every((module) => orderedIds.includes(module.id))
  ) {
    throw new CourseServiceError(
      "Provide every module ID for this course exactly once.",
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.courseModule.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );

  return { courseId, orderedIds };
}

export async function updateLesson(
  lessonId: string,
  data: {
    title?: string;
    description?: string | null;
    content?: string | null;
    videoUrl?: string | null;
    durationMinutes?: number;
    order?: number;
    isPreview?: boolean;
  },
) {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: { course: { select: { status: true } } },
      },
    },
  });

  if (!lesson) {
    throw new CourseServiceError("Lesson not found.", 404);
  }

  if (lesson.module.course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  return prisma.courseLesson.update({
    where: { id: lessonId },
    data,
  });
}

export async function deleteLesson(lessonId: string) {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: { course: { select: { status: true } } },
      },
      _count: { select: { progresses: true } },
    },
  });

  if (!lesson) {
    throw new CourseServiceError("Lesson not found.", 404);
  }

  if (lesson.module.course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  if (lesson._count.progresses > 0) {
    throw new CourseServiceError(
      "Learners already have progress on this lesson. It cannot be deleted.",
      409,
    );
  }

  await prisma.courseLesson.delete({ where: { id: lessonId } });

  return { deleted: true, lessonId };
}

export async function reorderLessons(
  moduleId: string,
  orderedIds: string[],
) {
  const module = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    include: { course: { select: { status: true } } },
  });

  if (!module) {
    throw new CourseServiceError("Module not found.", 404);
  }

  if (module.course.status === CourseStatus.ARCHIVED) {
    throw new CourseServiceError("Archived courses cannot be edited.");
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new CourseServiceError("Duplicate lesson IDs are not allowed.");
  }

  const lessons = await prisma.courseLesson.findMany({
    where: { moduleId },
    select: { id: true },
  });

  if (
    lessons.length !== orderedIds.length ||
    !lessons.every((lesson) => orderedIds.includes(lesson.id))
  ) {
    throw new CourseServiceError(
      "Provide every lesson ID for this module exactly once.",
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.courseLesson.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );

  return { moduleId, orderedIds };
}
