import { randomUUID } from "node:crypto";
import {
  CourseEnrollmentStatus,
  CourseStatus,
  Prisma,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { CourseServiceError } from "./course.service.js";

export async function demoPayAndEnroll(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, price: true, status: true },
  });

  if (!course) {
    throw new CourseServiceError("Course not found.", 404);
  }

  if (course.status !== CourseStatus.PUBLISHED) {
    throw new CourseServiceError("This course is not available for enrollment.");
  }

  const existingEnrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  if (existingEnrollment) {
    return { alreadyEnrolled: true, enrollment: existingEnrollment };
  }

  try {
    const enrollment = await prisma.$transaction(async (transaction) => {
      const createdEnrollment = await transaction.courseEnrollment.create({
        data: { userId, courseId },
      });

      await transaction.coursePayment.create({
        data: {
          userId,
          courseId,
          amount: course.price,
          transactionId: randomUUID(),
          paymentMethod: "DEMO",
          isDemo: true,
        },
      });

      return createdEnrollment;
    });

    return { alreadyEnrolled: false, enrollment };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });

      if (enrollment) {
        return { alreadyEnrolled: true, enrollment };
      }
    }

    throw error;
  }
}

export async function getMyCourses(userId: string) {
  return prisma.courseEnrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          _count: { select: { modules: true } },
        },
      },
      progresses: {
        where: { isCompleted: true },
        select: { id: true },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });
}

export async function getMyLearningCourse(userId: string, courseId: string) {
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { order: "asc" },
            include: {
              lessons: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
      progresses: true,
    },
  });

  if (!enrollment) {
    throw new CourseServiceError("Course enrollment not found.", 404);
  }

  return enrollment;
}

export async function completeLesson(
  userId: string,
  courseId: string,
  lessonId: string,
) {
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      course: {
        include: {
          modules: {
            include: { lessons: { select: { id: true } } },
          },
        },
      },
    },
  });

  if (!enrollment) {
    throw new CourseServiceError("Course enrollment not found.", 404);
  }

  if (enrollment.status === CourseEnrollmentStatus.CANCELLED) {
    throw new CourseServiceError("This course enrollment is cancelled.");
  }

  const courseLessonIds = enrollment.course.modules.flatMap((module) =>
    module.lessons.map((lesson) => lesson.id),
  );

  if (!courseLessonIds.includes(lessonId)) {
    throw new CourseServiceError("Lesson not found in this course.", 404);
  }

  const lessonProgress = await prisma.courseLessonProgress.upsert({
    where: {
      enrollmentId_lessonId: {
        enrollmentId: enrollment.id,
        lessonId,
      },
    },
    update: { isCompleted: true, completedAt: new Date() },
    create: {
      enrollmentId: enrollment.id,
      lessonId,
      isCompleted: true,
      completedAt: new Date(),
    },
  });

  const totalLessons = courseLessonIds.length;
  const completedLessons = await prisma.courseLessonProgress.count({
    where: { enrollmentId: enrollment.id, isCompleted: true },
  });
  const courseCompleted =
    totalLessons > 0 && completedLessons === totalLessons;

  if (
    courseCompleted &&
    enrollment.status !== CourseEnrollmentStatus.COMPLETED
  ) {
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  return {
    courseCompleted,
    completedLessons,
    totalLessons,
    lessonProgress,
  };
}
