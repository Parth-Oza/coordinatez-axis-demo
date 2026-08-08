CREATE TABLE `newsletter_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`source` text DEFAULT 'coordinatez-field-notes' NOT NULL,
	`ip_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_newsletter_subscribers_email` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE INDEX `idx_newsletter_subscribers_created_at` ON `newsletter_subscribers` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_newsletter_subscribers_ip_created_at` ON `newsletter_subscribers` (`ip_hash`,`created_at`);