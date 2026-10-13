
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../config/cloudinary.js";
import { EventServiceError } from "../event/event.service.js";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function uploadBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    resource_type: "image" | "raw";
    public_id: string;
  },
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resource_type,
        public_id: options.public_id,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary did not return an upload result."));
          return;
        }

        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

export async function uploadImage(file: Express.Multer.File) {
  const detected = await fileTypeFromBuffer(file.buffer);

  if (!detected || !allowedImageTypes.has(detected.mime)) {
    throw new EventServiceError(
      "Invalid image content. Upload a valid JPG, PNG, WEBP or GIF.",
      400,
    );
  }

  const result = await uploadBuffer(file.buffer, {
    folder: "ysse/images",
    resource_type: "image",
    public_id: randomUUID(),
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function uploadDocument(file: Express.Multer.File) {
  const detected = await fileTypeFromBuffer(file.buffer);

  if (!detected || detected.mime !== "application/pdf") {
    throw new EventServiceError(
      "Invalid document. Only valid PDF files are allowed.",
      400,
    );
  }

  const result = await uploadBuffer(file.buffer, {
    folder: "ysse/documents",
    resource_type: "raw",
    public_id: randomUUID(),
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
  };
}

// Delete an uploaded image from Cloudinary.
export async function deleteUploadedImage(
  publicId: string,
): Promise<void> {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Failed to delete image from Cloudinary.");
  }
}
