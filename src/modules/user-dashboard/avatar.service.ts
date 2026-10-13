
import { prisma } from "../../config/prisma.js";
import {
  uploadImage,
  deleteUploadedImage,
} from "../upload/upload.service.js";
import { UserDashboardError } from "./user-dashboard.service.js";

export async function updateMyAvatar(
  userId: string,
  file: Express.Multer.File,
) {
  if (!file) {
    throw new UserDashboardError("Please select an image.", 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      avatarPublicId: true,
    },
  });

  if (!existingUser) {
    throw new UserDashboardError("User not found.", 404);
  }

  // Upload the new image first so the existing avatar remains intact
  // if uploading fails.
  const uploaded = await uploadImage(file);

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: uploaded.url,
        avatarPublicId: uploaded.publicId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });

    // Delete the previous avatar only after the database is updated.
    if (
      existingUser.avatarPublicId &&
      existingUser.avatarPublicId !== uploaded.publicId
    ) {
      try {
        await deleteUploadedImage(existingUser.avatarPublicId);
      } catch (error) {
        // The profile is saved; log cleanup failure for later retry.
        console.error("Failed to delete previous avatar:", error);
      }
    }

    return updatedUser;
  } catch (error) {
    // Avoid leaving the newly uploaded image behind if saving fails.
    try {
      await deleteUploadedImage(uploaded.publicId);
    } catch (cleanupError) {
      console.error("Failed to clean up uploaded avatar:", cleanupError);
    }

    throw error;
  }
}

export async function removeMyAvatar(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      avatarPublicId: true,
    },
  });

  if (!user) {
    throw new UserDashboardError("User not found.", 404);
  }

  if (!user.avatarPublicId) {
    return { id: user.id, avatarUrl: null };
  }

  // Keep the database consistent with the user's removal request.
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl: null,
      avatarPublicId: null,
    },
    select: {
      id: true,
      avatarUrl: true,
    },
  });

  try {
    await deleteUploadedImage(user.avatarPublicId);
  } catch (error) {
    console.error("Failed to delete removed avatar from Cloudinary:", error);
  }

  return updatedUser;
}
