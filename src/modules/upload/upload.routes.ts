
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { upload } from "./upload.middleware.js";
import {
  uploadImageHandler,
  uploadDocumentHandler,
} from "./upload.controller.js";

const router = Router();

// Logged-in users can upload images.
router.post(
  "/image",
  authenticate,
  upload.single("file"),
  uploadImageHandler,
);

// Only Admin / Moderator can upload documents.
router.post(
  "/file",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  upload.single("file"),
  uploadDocumentHandler,
);

export default router;
