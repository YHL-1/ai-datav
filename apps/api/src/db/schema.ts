/**
 * 数据表定义（计划书 6.1）。
 * MVP 先落地 users / projects / sessions / 邮箱验证码。
 */
import type { CanvasSchema } from "@nexa/schema";
import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    email: varchar("email", { length: 190 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 60 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const PROJECT_TYPES = ["draft", "template"] as const;

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    type: mysqlEnum("type", PROJECT_TYPES).notNull().default("draft"),
    canvasJson: json("canvas_json").$type<CanvasSchema>().notNull(),
    revision: int("revision", { unsigned: true }).notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("projects_user_type_updated_idx").on(
      table.userId,
      table.type,
      table.updatedAt,
    ),
    index("projects_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

/** 会话：只存 token 的哈希，Cookie 里放原始 token */
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userAgent: varchar("user_agent", { length: 255 }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const VERIFICATION_PURPOSES = ["register"] as const;

/** 上传的数据文件：内容落本地磁盘，这里只存元数据与预览 */
export const datasets = mysqlTable(
  "datasets",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    fileName: varchar("file_name", { length: 190 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: int("size", { unsigned: true }).notNull(),
    rowCount: int("row_count", { unsigned: true }).notNull(),
    columnsJson: json("columns_json").$type<string[]>().notNull(),
    previewJson: json("preview_json")
      .$type<Record<string, string>[]>()
      .notNull(),
    storagePath: varchar("storage_path", { length: 255 }).notNull(),
    /** file = 上传文件；api = 外部 HTTP 接口实时拉取 */
    kind: varchar("kind", { length: 16 }).notNull().default("file"),
    sourceUrl: varchar("source_url", { length: 600 }),
    refreshSeconds: int("refresh_seconds", { unsigned: true })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("datasets_user_created_idx").on(table.userId, table.createdAt),
  ],
);

/** 邮箱验证码：只存加盐哈希，10 分钟有效 */
export const emailVerificationCodes = mysqlTable(
  "email_verification_codes",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    email: varchar("email", { length: 190 }).notNull(),
    salt: varchar("salt", { length: 32 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    purpose: mysqlEnum("purpose", VERIFICATION_PURPOSES)
      .notNull()
      .default("register"),
    attempts: int("attempts", { unsigned: true }).notNull().default(0),
    consumedAt: timestamp("consumed_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("email_codes_email_idx").on(
      table.email,
      table.purpose,
      table.createdAt,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type DatasetRow = typeof datasets.$inferSelect;
