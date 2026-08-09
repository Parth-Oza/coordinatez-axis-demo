CREATE TABLE `coordinatez_auth_events` (
	`id` text PRIMARY KEY NOT NULL,
	`ip_hash` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_coordinatez_auth_events_ip_action_created` ON `coordinatez_auth_events` (`ip_hash`,`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `coordinatez_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`configuration` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `coordinatez_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_coordinatez_projects_user_updated` ON `coordinatez_projects` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `coordinatez_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `coordinatez_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_coordinatez_sessions_user` ON `coordinatez_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_coordinatez_sessions_expiry` ON `coordinatez_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `coordinatez_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_coordinatez_users_email` ON `coordinatez_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_coordinatez_users_created_at` ON `coordinatez_users` (`created_at`);