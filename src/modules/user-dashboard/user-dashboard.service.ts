
import {
  CourseEnrollmentStatus,
  EventStatus,
  InternshipApplicationStatus,
  InternshipInterviewStatus,
  NoticeStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export class UserDashboardError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "UserDashboardError";
  }
}

function getPagination(pageInput?: number, limitInput?: number) {
  const page = Math.max(1, Math.floor(Number(pageInput) || 1));
  const limit = Math.min(
    50,
    Math.max(1, Math.floor(Number(limitInput) || 10)),
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

const profileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

const applicationInclude = {
  program: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      deadline: true,
      department: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} as const;

const courseSelect = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  thumbnailUrl: true,
  price: true,
  durationHours: true,
  status: true,
} as const;

const courseInclude = {
  course: {
    select: {
      ...courseSelect,
      modules: {
        select: {
          _count: {
            select: {
              lessons: true,
            },
          },
        },
      },
    },
  },
  progresses: {
    where: { isCompleted: true },
    select: { lessonId: true },
  },
} as const;

function formatEnrollment(enrollment: {
  id: string;
  status: CourseEnrollmentStatus;
  enrolledAt: Date;
  completedAt: Date | null;
  course: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    thumbnailUrl: string | null;
    price: unknown;
    durationHours: number;
    status: string;
    modules: { _count: { lessons: number } }[];
  };
  progresses: { lessonId: string }[];
}) {
  const totalLessons = enrollment.course.modules.reduce(
    (total, module) => total + module._count.lessons,
    0,
  );

  const completedLessons = enrollment.progresses.length;

  const progressPercent =
    totalLessons === 0
      ? 0
      : Math.min(100, Math.round((completedLessons / totalLessons) * 100));

  const { modules: _modules, ...course } = enrollment.course;

  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    completedAt: enrollment.completedAt,
    course,
    totalLessons,
    completedLessons,
    progressPercent,
  };
}

export async function getMyProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: profileSelect,
  });

  if (!user) {
    throw new UserDashboardError("User not found.", 404);
  }

  return user;
}

export async function updateMyProfile(
  userId: string,
  input: { name?: string },
) {
  const data: { name?: string } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (name.length < 2 || name.length > 100) {
      throw new UserDashboardError(
        "Name must be between 2 and 100 characters.",
      );
    }

    data.name = name;
  }

  if (Object.keys(data).length === 0) {
    throw new UserDashboardError(
      "Provide a valid field to update.",
    );
  }

  const result = await prisma.user.updateMany({
    where: { id: userId },
    data,
  });

  if (result.count === 0) {
    throw new UserDashboardError("User not found.", 404);
  }

  return getMyProfile(userId);
}

export async function getDashboardOverview(userId: string) {
  const user = await getMyProfile(userId);
  const now = new Date();

  const [
    totalApplications,
    applicationGroups,
    activeCourses,
    completedCourses,
    recentApplications,
    recentEnrollments,
    recentNotices,
    upcomingEvents,
    upcomingInterviews,
  ] = await Promise.all([
    prisma.internshipApplication.count({
      where: { userId },
    }),

    prisma.internshipApplication.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),

    prisma.courseEnrollment.count({
      where: {
        userId,
        status: CourseEnrollmentStatus.ACTIVE,
      },
    }),

    prisma.courseEnrollment.count({
      where: {
        userId,
        status: CourseEnrollmentStatus.COMPLETED,
      },
    }),

    prisma.internshipApplication.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        createdAt: true,
        updatedAt: true,
        program: applicationInclude.program,
      },
      orderBy: { appliedAt: "desc" },
      take: 5,
    }),

    prisma.courseEnrollment.findMany({
      where: {
        userId,
        status: {
          in: [
            CourseEnrollmentStatus.ACTIVE,
            CourseEnrollmentStatus.COMPLETED,
          ],
        },
      },
      select: {
        id: true,
        status: true,
        enrolledAt: true,
        completedAt: true,
        ...courseInclude,
      },
      orderBy: { enrolledAt: "desc" },
      take: 5,
    }),

    prisma.notice.findMany({
      where: { status: NoticeStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),

    prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        startDate: { gte: now },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        imageUrl: true,
        location: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
      take: 5,
    }),

    prisma.internshipInterview.findMany({
      where: {
        scheduledAt: { gte: now },
        status: InternshipInterviewStatus.SCHEDULED,
        application: { userId },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        meetingUrl: true,
        location: true,
        status: true,
        application: {
          select: {
            id: true,
            program: {
              select: {
                title: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  const applicationStatusCounts = Object.fromEntries(
    Object.values(InternshipApplicationStatus).map((status) => [
      status,
      applicationGroups.find((item) => item.status === status)?._count._all ?? 0,
    ]),
  );

  return {
    user,
    statistics: {
      totalApplications,
      applicationStatusCounts,
      activeCourses,
      completedCourses,
      totalEnrolledCourses: activeCourses + completedCourses,
    },
    recentApplications,
    recentCourses: recentEnrollments.map(formatEnrollment),
    recentNotices,
    upcomingEvents,
    upcomingInterviews,
  };
}

export async function getMyApplications(
  userId: string,
  pageInput?: number,
  limitInput?: number,
) {
  const { page, limit, skip } = getPagination(pageInput, limitInput);

  const where = { userId };

  const [applications, total] = await prisma.$transaction([
    prisma.internshipApplication.findMany({
      where,
      select: {
        id: true,
        status: true,
        cvUrl: true,
        coverLetter: true,
        appliedAt: true,
        createdAt: true,
        updatedAt: true,
        program: applicationInclude.program,
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.internshipApplication.count({ where }),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getMyDashboardCourses(
  userId: string,
  pageInput?: number,
  limitInput?: number,
) {
  const { page, limit, skip } = getPagination(pageInput, limitInput);

  const where = {
    userId,
    status: {
      in: [
        CourseEnrollmentStatus.ACTIVE,
        CourseEnrollmentStatus.COMPLETED,
      ],
    },
  };

  const [enrollments, total] = await prisma.$transaction([
    prisma.courseEnrollment.findMany({
      where,
      select: {
        id: true,
        status: true,
        enrolledAt: true,
        completedAt: true,
        ...courseInclude,
      },
      orderBy: { enrolledAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.courseEnrollment.count({ where }),
  ]);

  return {
    courses: enrollments.map(formatEnrollment),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
