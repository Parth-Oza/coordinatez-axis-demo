import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projectBriefs = sqliteTable(
  "project_briefs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    postalCode: text("postal_code"),
    notes: text("notes"),
    configuration: text("configuration").notNull(),
    status: text("status").notNull().default("new"),
    consent: integer("consent", { mode: "boolean" }).notNull().default(false),
    source: text("source").notNull().default("coordinatez-web"),
    ipHash: text("ip_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_project_briefs_created_at").on(table.createdAt),
    index("idx_project_briefs_status_created_at").on(table.status, table.createdAt),
    index("idx_project_briefs_ip_created_at").on(table.ipHash, table.createdAt),
  ],
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    source: text("source").notNull().default("coordinatez-field-notes"),
    ipHash: text("ip_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_newsletter_subscribers_email").on(table.email),
    index("idx_newsletter_subscribers_created_at").on(table.createdAt),
    index("idx_newsletter_subscribers_ip_created_at").on(table.ipHash, table.createdAt),
  ],
);

export const coordinatezUsers = sqliteTable(
  "coordinatez_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_coordinatez_users_email").on(table.email),
    index("idx_coordinatez_users_created_at").on(table.createdAt),
  ],
);

export const coordinatezSessions = sqliteTable(
  "coordinatez_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => coordinatezUsers.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_coordinatez_sessions_user").on(table.userId),
    index("idx_coordinatez_sessions_expiry").on(table.expiresAt),
  ],
);

export const coordinatezProjects = sqliteTable(
  "coordinatez_projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => coordinatezUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    configuration: text("configuration").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_coordinatez_projects_user_updated").on(table.userId, table.updatedAt),
  ],
);

export const coordinatezAuthEvents = sqliteTable(
  "coordinatez_auth_events",
  {
    id: text("id").primaryKey(),
    ipHash: text("ip_hash").notNull(),
    action: text("action").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_coordinatez_auth_events_ip_action_created").on(table.ipHash, table.action, table.createdAt),
  ],
);
