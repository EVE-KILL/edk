CREATE TABLE `scheduled_task_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`status` text NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`duration_ms` integer,
	`output` text,
	`error` text,
	`triggered_by` text NOT NULL,
	`triggered_by_user` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_id_idx` ON `scheduled_task_runs` (`task_id`);--> statement-breakpoint
CREATE INDEX `run_created_at_idx` ON `scheduled_task_runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `run_status_idx` ON `scheduled_task_runs` (`status`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`schedule` text,
	`enabled` integer DEFAULT true NOT NULL,
	`module` text NOT NULL,
	`tags` text,
	`timeout` integer DEFAULT 30000 NOT NULL,
	`max_concurrent` integer DEFAULT 1 NOT NULL,
	`last_run_at` integer,
	`last_completed_at` integer,
	`last_failure_at` integer,
	`next_scheduled_at` integer,
	`total_runs` integer DEFAULT 0 NOT NULL,
	`successful_runs` integer DEFAULT 0 NOT NULL,
	`failed_runs` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_name_unique` ON `tasks` (`name`);--> statement-breakpoint
CREATE INDEX `enabled_schedule_idx` ON `tasks` (`enabled`,`schedule`,`next_scheduled_at`);--> statement-breakpoint
CREATE INDEX `tasks_name_idx` ON `tasks` (`name`);--> statement-breakpoint
CREATE INDEX `tasks_tags_idx` ON `tasks` (`tags`);