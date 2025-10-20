CREATE TABLE `prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type_id` integer NOT NULL,
	`date` integer NOT NULL,
	`average` real,
	`highest` real,
	`lowest` real,
	`order_count` integer,
	`volume` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prices_type_id_idx` ON `prices` (`type_id`);--> statement-breakpoint
CREATE INDEX `prices_date_idx` ON `prices` (`date`);--> statement-breakpoint
CREATE INDEX `prices_type_id_date_idx` ON `prices` (`type_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `prices_type_id_date_unique` ON `prices` (`type_id`,`date`);