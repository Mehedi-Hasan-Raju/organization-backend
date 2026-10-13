
import type { Request, Response, NextFunction } from "express";
import { EventServiceError } from "../event/event.service.js";
import { uploadImage, uploadDocument } from "./upload.service.js";

export async function uploadImageHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please select an image to upload.",
      });
      return;
    }

    const result = await uploadImage(req.file);

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully.",
      file: result,
    });
  } catch (error) {
    if (error instanceof EventServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function uploadDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please select a PDF file to upload.",
      });
      return;
    }

    const result = await uploadDocument(req.file);

    res.status(201).json({
      success: true,
      message: "PDF uploaded successfully.",
      file: result,
    });
  } catch (error) {
    if (error instanceof EventServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}
