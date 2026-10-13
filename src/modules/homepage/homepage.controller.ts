
import type { NextFunction, Request, Response } from "express";
import { getHomepageData } from "./homepage.service.js";

export async function getHomepageHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getHomepageData();

    res.status(200).json({
      success: true,
      message: "Homepage data fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}
