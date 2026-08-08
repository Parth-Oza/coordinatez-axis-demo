import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
