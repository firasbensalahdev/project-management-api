import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "../config/s3";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const validateFile = (mimetype: string, size: number): void => {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new Error("Only JPEG, PNG and WebP images are allowed");
  }
  if (size > MAX_FILE_SIZE) {
    throw new Error("File size must be less than 5MB");
  }
};

export const uploadToS3 = async (
  file: Express.Multer.File,
  folder: string,
): Promise<string> => {
  validateFile(file.mimetype, file.size);

  const extension = path.extname(file.originalname);
  const key = `${folder}/${uuidv4()}${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

export const deleteFromS3 = async (imageUrl: string): Promise<void> => {
  const key = imageUrl.split(".amazonaws.com/")[1];
  if (!key) return;

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
  );
};

export const generatePresignedUrl = async (
  folder: string,
  filename: string,
  mimetype: string,
): Promise<{ uploadUrl: string; fileUrl: string }> => {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new Error("Only JPEG, PNG and WebP images are allowed");
  }

  const extension = path.extname(filename);
  const key = `${folder}/${uuidv4()}${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: mimetype,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes
  });

  const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return { uploadUrl, fileUrl };
};
