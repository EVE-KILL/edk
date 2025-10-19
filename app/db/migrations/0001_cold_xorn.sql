CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`available_at` integer NOT NULL,
	`reserved_at` integer,
	`processed_at` integer,
	`created_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error` text,
	`priority` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `status_queue_priority_idx` ON `jobs` (`status`,`queue`,`priority`,`available_at`);--> statement-breakpoint
CREATE INDEX `status_processed_idx` ON `jobs` (`status`,`processed_at`);--> statement-breakpoint
CREATE INDEX `queue_status_idx` ON `jobs` (`queue`,`status`);