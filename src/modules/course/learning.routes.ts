
import { Router } from "express";
import {
  markLessonComplete,
  myCourses,
  myLearningCourse,
  payAndEnroll,
} from "./learning.controller.js";
import { authenticate } from "../../middlewares/authenticate.js";

const router = Router();

// Every route in this file requires a logged-in user.
router.use(authenticate);

router.get("/my-courses", myCourses);
router.get("/my-courses/:courseId", myLearningCourse);
router.post("/:courseId/pay", payAndEnroll);
router.patch(
  "/my-courses/:courseId/lessons/:lessonId/complete",
  markLessonComplete,
);

export default router;
