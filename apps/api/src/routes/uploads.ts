import type { FastifyInstance } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config.js";
import { generateId } from "../lib/crypto.js";
import { sendError } from "../lib/http.js";

/** 图片组件使用的资源：上传后落盘，按不可猜测的文件名静态回读 */
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const SAFE_FILE = /^[a-zA-Z0-9_.-]+$/;

export function uploadRoutes(config: AppConfig) {
  return async function (app: FastifyInstance) {
    app.post("/uploads", async (request, reply) => {
      let file;
      try {
        file = await request.file();
      } catch {
        return sendError(
          reply,
          413,
          "PAYLOAD_TOO_LARGE",
          "图片上传失败：仅支持 ≤ 10 MB 的图片",
        );
      }

      if (!file) {
        return sendError(reply, 400, "VALIDATION_ERROR", "请选择要上传的图片");
      }

      const originalName = path.basename(file.filename || "");
      const extension = path.extname(originalName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "仅支持 PNG / JPG / WebP / GIF / SVG 图片",
        );
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch {
        return sendError(reply, 413, "PAYLOAD_TOO_LARGE", "图片超过 10 MB 限制");
      }

      const id = generateId("img");
      const userDir = path.resolve(config.uploadDir, request.authUser!.id);
      const fileName = `${id}${extension}`;
      await mkdir(userDir, { recursive: true });
      await writeFile(path.join(userDir, fileName), buffer);

      return {
        url: `/api/assets/${request.authUser!.id}/${fileName}`,
        size: buffer.byteLength,
      };
    });

    /** 公开只读：<img> 直接引用，无需携带会话 */
    app.get(
      "/assets/:userId/:fileName",
      async (request, reply) => {
        const { userId, fileName } = request.params as {
          userId: string;
          fileName: string;
        };

        if (!SAFE_SEGMENT.test(userId) || !SAFE_FILE.test(fileName)) {
          return sendError(reply, 400, "VALIDATION_ERROR", "非法的图片地址");
        }

        const root = path.resolve(config.uploadDir);
        const filePath = path.resolve(root, userId, fileName);
        if (!filePath.startsWith(`${root}${path.sep}`)) {
          return sendError(reply, 400, "VALIDATION_ERROR", "非法的图片地址");
        }

        try {
          const buffer = await readFile(filePath);
          reply.header(
            "Content-Type",
            MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] ??
              "application/octet-stream",
          );
          reply.header("Cache-Control", "public, max-age=31536000, immutable");
          return reply.send(buffer);
        } catch {
          return sendError(reply, 404, "NOT_FOUND", "图片不存在");
        }
      },
    );
  };
}
