CREATE TABLE `project_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`postal_code` text,
	`notes` text,
	`configuration` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`consent` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'coordinatez-web' NOT NULL,
	`ip_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_project_briefs_created_at` ON `project_briefs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_project_briefs_status_created_at` ON `project_briefs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_project_briefs_ip_created_at` ON `project_briefs` (`ip_hash`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
