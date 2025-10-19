CREATE TABLE `killmails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`killmail_id` integer NOT NULL,
	`hash` text NOT NULL,
	`killmail_time` integer NOT NULL,
	`solar_system_id` integer NOT NULL,
	`victim` text,
	`attackers` text,
	`items` text,
	`total_value` integer,
	`attacker_count` integer DEFAULT 0 NOT NULL,
	`points` integer,
	`is_solo` integer DEFAULT false NOT NULL,
	`is_npc` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `killmails_killmail_id_unique` ON `killmails` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `killmail_id_idx` ON `killmails` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `hash_idx` ON `killmails` (`hash`);--> statement-breakpoint
CREATE INDEX `killmail_time_idx` ON `killmails` (`killmail_time`);--> statement-breakpoint
CREATE INDEX `solar_system_id_idx` ON `killmails` (`solar_system_id`);--> statement-breakpoint
CREATE INDEX `total_value_idx` ON `killmails` (`total_value`);