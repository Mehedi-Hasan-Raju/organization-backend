
import { Router } from "express";
import {
  archiveCourseHandler,
  deleteCourseHandler,
  deleteLessonHandler,
  deleteModuleHandler,
  getAdminCourses,
  getCourse,
  getCourseAnalytics,
  getCourses,
  patchCourse,
  patchLesson,
  patchModule,
  postCourse,
  postLesson,
  postModule,
  publishCourseHandler,
  reorderLessonsHandler,
  reorderModulesHandler,
} from "./course.controller.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";

const router = Router();

const managers = [authenticate, authorize("ADMIN", "MODERATOR")];

// Public routes
router.get("/", getCourses);

// Admin / Moderator reporting and course list
router.get("/admin/analytics", ...managers, getCourseAnalytics);
router.get("/admin/list", ...managers, getAdminCourses);

// Course CRUD and publishing
router.post("/", ...managers, postCourse);
router.patch("/:id", ...managers, patchCourse);
router.delete("/:id", ...managers, deleteCourseHandler);
router.patch("/:id/publish", ...managers, publishCourseHandler);
router.patch("/:id/archive", ...managers, archiveCourseHandler);

// Module management
router.post("/:id/modules", ...managers, postModule);
router.patch("/modules/:moduleId", ...managers, patchModule);
router.delete("/modules/:moduleId", ...managers, deleteModuleHandler);
router.patch("/:id/modules/reorder", ...managers, reorderModulesHandler);

// Lesson management
router.post("/modules/:moduleId/lessons", ...managers, postLesson);
router.patch("/lessons/:lessonId", ...managers, patchLesson);
router.delete("/lessons/:lessonId", ...managers, deleteLessonHandler);
router.patch(
  "/modules/:moduleId/lessons/reorder",
  ...managers,
  reorderLessonsHandler,
);

// Keep public slug route last.
router.get("/:slug", getCourse);

export default router;
