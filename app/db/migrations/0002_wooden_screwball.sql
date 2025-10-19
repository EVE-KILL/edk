CREATE TABLE `characters` (
	`character_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`corporation_id` integer NOT NULL,
	`alliance_id` integer,
	`faction_id` integer,
	`birthday` integer NOT NULL,
	`security_status` text,
	`title` text,
	`raw_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `character_name_idx` ON `characters` (`name`);--> statement-breakpoint
CREATE INDEX `character_corporation_id_idx` ON `characters` (`corporation_id`);--> statement-breakpoint
CREATE INDEX `character_alliance_id_idx` ON `characters` (`alliance_id`);--> statement-breakpoint
CREATE INDEX `character_updated_at_idx` ON `characters` (`updated_at`);--> statement-breakpoint
CREATE TABLE `corporations` (
	`corporation_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ticker` text NOT NULL,
	`ceo_id` integer NOT NULL,
	`creator_id` integer NOT NULL,
	`date_founded` integer,
	`home_station_id` integer,
	`member_count` integer DEFAULT 0 NOT NULL,
	`alliance_id` integer,
	`faction_id` integer,
	`tax_rate` text,
	`description` text,
	`url` text,
	`war_eligible` integer,
	`raw_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `corporation_name_idx` ON `corporations` (`name`);--> statement-breakpoint
CREATE INDEX `corporation_ticker_idx` ON `corporations` (`ticker`);--> statement-breakpoint
CREATE INDEX `corporation_alliance_id_idx` ON `corporations` (`alliance_id`);--> statement-breakpoint
CREATE INDEX `corporation_ceo_id_idx` ON `corporations` (`ceo_id`);--> statement-breakpoint
CREATE INDEX `corporation_updated_at_idx` ON `corporations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `alliances` (
	`alliance_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ticker` text NOT NULL,
	`creator_corporation_id` integer NOT NULL,
	`creator_id` integer NOT NULL,
	`date_founded` integer NOT NULL,
	`executor_corporation_id` integer,
	`faction_id` integer,
	`raw_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alliance_name_idx` ON `alliances` (`name`);--> statement-breakpoint
CREATE INDEX `alliance_ticker_idx` ON `alliances` (`ticker`);--> statement-breakpoint
CREATE INDEX `alliance_executor_corp_idx` ON `alliances` (`executor_corporation_id`);--> statement-breakpoint
CREATE INDEX `alliance_updated_at_idx` ON `alliances` (`updated_at`);--> statement-breakpoint
CREATE TABLE `esi_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_key` text NOT NULL,
	`etag` text,
	`expires_at` integer,
	`last_modified` integer,
	`data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `esi_cache_cache_key_unique` ON `esi_cache` (`cache_key`);--> statement-breakpoint
CREATE INDEX `esi_cache_key_idx` ON `esi_cache` (`cache_key`);--> statement-breakpoint
CREATE INDEX `esi_cache_expires_at_idx` ON `esi_cache` (`expires_at`);