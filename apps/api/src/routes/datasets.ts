import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config.js";
import { db } from "../db/client.js";
import { datasets } from "../db/schema.js";
import { generateId } from "../lib/crypto.js";
import { sendError } from "../lib/http.js";

const MAX_PREVIEW_ROWS = 5;
const ALLOWED_EXTENSIONS = [".csv", ".json"];
const REMOTE_TIMEOUT_MS = 15_000;

interface ParsedTable {
  columns: string[];
  rows: Record<string, string>[];
}

/** 极简 CSV 解析：支持引号包裹、逗号转义与回车换行 */
function parseCsv(text: string): ParsedTable {
  const source = text.replace(/^\uFEFF/, "");
  const grid: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      grid.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    grid.push(row);
  }

  const usable = grid.filter((line) => line.some((cell) => cell.trim() !== ""));
  if (usable.length < 2) throw new Error("CSV 至少需要一行表头和一行数据");

  const header = usable[0];
  const columns = header.map((name, index) => name.trim() || `列 ${index + 1}`);
  const rows = usable.slice(1).map((line) => {
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      record[column] = (line[index] ?? "").trim();
    });
    return record;
  });

  return { columns, rows };
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function parseJson(text: string): ParsedTable {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON 文件格式不正确");
  }

  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (["data", "rows", "list", "records"] as const)
          .map((key) => (data as Record<string, unknown>)[key])
          .find((value) => Array.isArray(value))
      : undefined;

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("JSON 需要是对象数组，或 { data: [] } 结构");
  }

  const records = list.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
  if (records.length === 0) throw new Error("JSON 中没有可用的对象数据");

  const columns: string[] = [];
  records.slice(0, 200).forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!columns.includes(key)) columns.push(key);
    });
  });

  const rows = records.map((record) => {
    const normalized: Record<string, string> = {};
    columns.forEach((column) => {
      normalized[column] = stringifyCell(record[column]);
    });
    return normalized;
  });

  return { columns, rows };
}

function toIso(value: Date): string {
  return value.toISOString();
}

/** 服务端代理拉取外部 JSON 接口，避免浏览器跨域与 Key 泄露 */
async function fetchRemoteTable(url: string): Promise<ParsedTable> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error("接口地址格式不正确，请填写完整的 http(s) 地址");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("仅支持 http 或 https 接口地址");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`接口返回 ${response.status}，请确认地址可访问`);
    const text = await response.text();
    return parseJson(text);
  } catch (error) {
    if ((error as Error).name === "AbortError")
      throw new Error("接口请求超时（15 秒），请稍后重试");
    if (error instanceof TypeError)
      throw new Error("无法连接该接口，请检查地址或网络");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function mapDataset(row: typeof datasets.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    rowCount: row.rowCount,
    columns: row.columnsJson,
    preview: row.previewJson,
    kind: row.kind,
    sourceUrl: row.sourceUrl,
    refreshSeconds: row.refreshSeconds,
    createdAt: toIso(row.createdAt),
  };
}

export function datasetRoutes(config: AppConfig) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.get("/datasets", async (request) => {
      const rows = await db
        .select()
        .from(datasets)
        .where(eq(datasets.userId, request.authUser!.id))
        .orderBy(desc(datasets.createdAt))
        .limit(50);

      return { datasets: rows.map(mapDataset) };
    });

    app.post("/datasets", async (request, reply) => {
      let file;
      try {
        file = await request.file();
      } catch {
        return sendError(
          reply,
          413,
          "PAYLOAD_TOO_LARGE",
          "文件上传失败：仅支持 ≤ 10 MB 的 CSV / JSON 文件",
        );
      }

      if (!file) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "请选择要上传的数据文件",
        );
      }

      const originalName = path.basename(file.filename || "");
      const extension = path.extname(originalName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "仅支持 CSV 或 JSON 文件",
        );
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch {
        return sendError(
          reply,
          413,
          "PAYLOAD_TOO_LARGE",
          "文件超过 10 MB 限制",
        );
      }

      let table: ParsedTable;
      try {
        table =
          extension === ".csv"
            ? parseCsv(buffer.toString("utf8"))
            : parseJson(buffer.toString("utf8"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "文件解析失败";
        return sendError(reply, 400, "VALIDATION_ERROR", message);
      }

      const id = generateId("ds");
      const userDir = path.resolve(config.uploadDir, request.authUser!.id);
      const storagePath = path.join(userDir, `${id}${extension}`);
      await mkdir(userDir, { recursive: true });
      await writeFile(storagePath, buffer);

      const baseName = originalName
        .slice(0, originalName.length - extension.length)
        .trim();
      const name = (baseName || "未命名数据集").slice(0, 120);

      await db.insert(datasets).values({
        id,
        userId: request.authUser!.id,
        name,
        fileName: originalName.slice(0, 190),
        mimeType:
          file.mimetype ||
          (extension === ".csv" ? "text/csv" : "application/json"),
        size: buffer.byteLength,
        rowCount: table.rows.length,
        columnsJson: table.columns.slice(0, 50),
        previewJson: table.rows.slice(0, MAX_PREVIEW_ROWS),
        storagePath,
      });

      const [row] = await db
        .select()
        .from(datasets)
        .where(eq(datasets.id, id))
        .limit(1);
      return reply.status(201).send({ dataset: mapDataset(row) });
    });

    /** 接入外部 HTTP JSON 接口作为实时数据源 */
    app.post("/datasets/api", async (request, reply) => {
      const body = (request.body ?? {}) as {
        name?: string;
        url?: string;
        refreshSeconds?: number;
      };
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!url) {
        return sendError(reply, 400, "VALIDATION_ERROR", "请填写接口地址");
      }

      let table: ParsedTable;
      try {
        table = await fetchRemoteTable(url);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "接口数据解析失败";
        return sendError(reply, 400, "VALIDATION_ERROR", message);
      }

      const refreshSeconds = Math.min(
        3600,
        Math.max(5, Number(body.refreshSeconds) || 30),
      );
      const fallbackName = new URL(url).hostname.replace(/^www\./, "");
      const name = (body.name?.trim() || fallbackName || "实时接口").slice(
        0,
        120,
      );
      const id = generateId("ds");

      await db.insert(datasets).values({
        id,
        userId: request.authUser!.id,
        name,
        fileName: url.slice(0, 190),
        mimeType: "application/json",
        size: 0,
        rowCount: table.rows.length,
        columnsJson: table.columns.slice(0, 50),
        previewJson: table.rows.slice(0, MAX_PREVIEW_ROWS),
        storagePath: "",
        kind: "api",
        sourceUrl: url,
        refreshSeconds,
      });

      const [row] = await db
        .select()
        .from(datasets)
        .where(eq(datasets.id, id))
        .limit(1);
      return reply.status(201).send({ dataset: mapDataset(row) });
    });

    app.get("/datasets/:id/data", async (request, reply) => {
      const { id } = request.params as { id: string };
      const limit = Math.min(
        500,
        Math.max(1, Number((request.query as { limit?: string }).limit) || 200),
      );

      const [row] = await db
        .select()
        .from(datasets)
        .where(
          and(eq(datasets.id, id), eq(datasets.userId, request.authUser!.id)),
        )
        .limit(1);

      if (!row)
        return sendError(reply, 404, "NOT_FOUND", "数据集不存在或无权访问");

      let table: ParsedTable;
      if (row.kind === "api" && row.sourceUrl) {
        try {
          table = await fetchRemoteTable(row.sourceUrl);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "实时接口拉取失败";
          return sendError(reply, 502, "SOURCE_UNAVAILABLE", message);
        }
      } else {
        try {
          const content = await readFile(row.storagePath, "utf8");
          table = row.fileName.toLowerCase().endsWith(".json")
            ? parseJson(content)
            : parseCsv(content);
        } catch {
          return sendError(
            reply,
            410,
            "SOURCE_UNAVAILABLE",
            "数据文件已不存在，请重新上传",
          );
        }
      }

      return {
        id: row.id,
        name: row.name,
        rowCount: table.rows.length,
        columns: table.columns.slice(0, 50),
        rows: table.rows.slice(0, limit),
        kind: row.kind,
        refreshSeconds: row.refreshSeconds,
      };
    });

    app.delete("/datasets/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const [row] = await db
        .select()
        .from(datasets)
        .where(
          and(eq(datasets.id, id), eq(datasets.userId, request.authUser!.id)),
        )
        .limit(1);

      if (!row)
        return sendError(reply, 404, "NOT_FOUND", "数据集不存在或无权访问");

      await db.delete(datasets).where(eq(datasets.id, id));
      if (row.kind !== "api") {
        await unlink(row.storagePath).catch(() => undefined);
      }
      return reply.status(204).send();
    });
  };
}
