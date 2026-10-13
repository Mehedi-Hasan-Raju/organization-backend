
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CourseServiceError } from "./course.service.js";
import {
  completeLesson,
  demoPayAndEnroll,
  getMyCourses,
  getMyLearningCourse,
} from "./learning.service.js";

type AuthRequest = Request & {
  user: { id: string };
};

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

const courseIdSchema = z.object({
  courseId: z.string().min(1),
});

export async function payAndEnroll(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const { courseId } = courseIdSchema.parse(req.params);
    const result = await demoPayAndEnroll(
      (req as AuthRequest).user.id,
      courseId,
    );
    const {
      success: _success,
      message: _message,
      demoPayment: _demoPayment,
      ...payload
    } = result;

    return res.status(result.alreadyEnrolled ? 200 : 201).json({
      success: true,
      message: result.alreadyEnrolled
        ? "You are already enrolled in this course."
        : "Demo payment successful. You are now enrolled.",
      demoPayment: true,
      ...payload,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function myCourses(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const courses = await getMyCourses((req as AuthRequest).user.id);
    return res.json({ success: true, courses });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function myLearningCourse(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const { courseId } = courseIdSchema.parse(req.params);
    const enrollment = await getMyLearningCourse(
      (req as AuthRequest).user.id,
      courseId,
    );

    return res.json({ success: true, enrollment });
  } catch (error) {
    return handleError(error, res, next);
  }
}

export async function markLessonComplete(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const params = z.object({
      courseId: z.string().min(1),
      lessonId: z.string().min(1),
    }).parse(req.params);

    const result = await completeLesson(
      (req as AuthRequest).user.id,
      params.courseId,
      params.lessonId,
    );

    return res.json({
      success: true,
      message: result.courseCompleted
        ? "Congratulations! You completed this course."
        : "Lesson marked as completed.",
      progress: result,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}
