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
CREATE INDEX `tasks_tags_idx` ON `tasks` (`tags`);--> statement-breakpoint
CREATE TABLE `killmails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`killmail_id` integer NOT NULL,
	`hash` text NOT NULL,
	`killmail_time` integer NOT NULL,
	`solar_system_id` integer NOT NULL,
	`attacker_count` integer DEFAULT 0 NOT NULL,
	`ship_value` text DEFAULT '0' NOT NULL,
	`fitted_value` text DEFAULT '0' NOT NULL,
	`dropped_value` text DEFAULT '0' NOT NULL,
	`destroyed_value` text DEFAULT '0' NOT NULL,
	`total_value` text DEFAULT '0' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`is_solo` integer DEFAULT false NOT NULL,
	`is_npc` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `killmails_killmail_id_unique` ON `killmails` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `killmail_killmail_id_idx` ON `killmails` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `killmail_time_idx` ON `killmails` (`killmail_time`);--> statement-breakpoint
CREATE INDEX `killmail_solar_system_id_idx` ON `killmails` (`solar_system_id`);--> statement-breakpoint
CREATE INDEX `killmail_is_solo_idx` ON `killmails` (`is_solo`);--> statement-breakpoint
CREATE INDEX `killmail_is_npc_idx` ON `killmails` (`is_npc`);--> statement-breakpoint
CREATE INDEX `killmail_total_value_idx` ON `killmails` (`total_value`);--> statement-breakpoint
CREATE INDEX `killmail_time_desc_system_idx` ON `killmails` (`killmail_time`,`solar_system_id`);--> statement-breakpoint
CREATE TABLE `victims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`killmail_id` integer NOT NULL,
	`character_id` integer,
	`corporation_id` integer NOT NULL,
	`alliance_id` integer,
	`faction_id` integer,
	`ship_type_id` integer NOT NULL,
	`damage_taken` integer NOT NULL,
	`position_x` text,
	`position_y` text,
	`position_z` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`killmail_id`) REFERENCES `killmails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `victim_killmail_id_idx` ON `victims` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `victim_character_id_idx` ON `victims` (`character_id`);--> statement-breakpoint
CREATE INDEX `victim_corporation_id_idx` ON `victims` (`corporation_id`);--> statement-breakpoint
CREATE INDEX `victim_alliance_id_idx` ON `victims` (`alliance_id`);--> statement-breakpoint
CREATE INDEX `victim_ship_type_id_idx` ON `victims` (`ship_type_id`);--> statement-breakpoint
CREATE TABLE `attackers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`killmail_id` integer NOT NULL,
	`character_id` integer,
	`corporation_id` integer,
	`alliance_id` integer,
	`faction_id` integer,
	`ship_type_id` integer,
	`weapon_type_id` integer,
	`damage_done` integer NOT NULL,
	`security_status` text,
	`final_blow` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`killmail_id`) REFERENCES `killmails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attacker_killmail_id_idx` ON `attackers` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `attacker_character_id_idx` ON `attackers` (`character_id`);--> statement-breakpoint
CREATE INDEX `attacker_corporation_id_idx` ON `attackers` (`corporation_id`);--> statement-breakpoint
CREATE INDEX `attacker_alliance_id_idx` ON `attackers` (`alliance_id`);--> statement-breakpoint
CREATE INDEX `attacker_ship_type_id_idx` ON `attackers` (`ship_type_id`);--> statement-breakpoint
CREATE INDEX `attacker_weapon_type_id_idx` ON `attackers` (`weapon_type_id`);--> statement-breakpoint
CREATE INDEX `attacker_final_blow_idx` ON `attackers` (`final_blow`);--> statement-breakpoint
CREATE INDEX `attacker_final_blow_character_id_idx` ON `attackers` (`final_blow`,`character_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`killmail_id` integer NOT NULL,
	`item_type_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`flag` integer NOT NULL,
	`singleton` integer NOT NULL,
	`dropped` integer DEFAULT false NOT NULL,
	`destroyed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`killmail_id`) REFERENCES `killmails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_killmail_id_idx` ON `items` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `item_item_type_id_idx` ON `items` (`item_type_id`);--> statement-breakpoint
CREATE INDEX `item_dropped_idx` ON `items` (`dropped`);--> statement-breakpoint
CREATE INDEX `item_destroyed_idx` ON `items` (`destroyed`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `prices_type_id_date_unique` ON `prices` (`type_id`,`date`);--> statement-breakpoint
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
CREATE TABLE `solar_systems` (
	`system_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`constellation_id` integer NOT NULL,
	`region_id` integer,
	`security_status` text NOT NULL,
	`star_id` integer,
	`position_x` text,
	`position_y` text,
	`position_z` text,
	`security_class` text,
	`raw_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `solar_system_name_idx` ON `solar_systems` (`name`);--> statement-breakpoint
CREATE INDEX `solar_system_constellation_id_idx` ON `solar_systems` (`constellation_id`);--> statement-breakpoint
CREATE INDEX `solar_system_region_id_idx` ON `solar_systems` (`region_id`);--> statement-breakpoint
CREATE INDEX `solar_system_security_status_idx` ON `solar_systems` (`security_status`);--> statement-breakpoint
CREATE INDEX `solar_system_updated_at_idx` ON `solar_systems` (`updated_at`);--> statement-breakpoint
CREATE TABLE `regions` (
	`region_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`center_x` text,
	`center_y` text,
	`center_z` text,
	`max_x` text,
	`max_y` text,
	`max_z` text,
	`min_x` text,
	`min_y` text,
	`min_z` text,
	`nebula_id` integer,
	`raw_data` text
);
--> statement-breakpoint
CREATE TABLE `types` (
	`type_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`group_id` integer NOT NULL,
	`category_id` integer,
	`published` integer DEFAULT true NOT NULL,
	`market_group_id` integer,
	`mass` text,
	`volume` text,
	`capacity` text,
	`portion_size` integer,
	`radius` text,
	`icon_id` integer,
	`graphic_id` integer,
	`raw_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `type_name_idx` ON `types` (`name`);--> statement-breakpoint
CREATE INDEX `type_group_id_idx` ON `types` (`group_id`);--> statement-breakpoint
CREATE INDEX `type_category_id_idx` ON `types` (`category_id`);--> statement-breakpoint
CREATE INDEX `type_published_idx` ON `types` (`published`);--> statement-breakpoint
CREATE INDEX `type_updated_at_idx` ON `types` (`updated_at`);--> statement-breakpoint
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
CREATE INDEX `esi_cache_expires_at_idx` ON `esi_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`category_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`icon_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `category_name_idx` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `category_published_idx` ON `categories` (`published`);--> statement-breakpoint
CREATE TABLE `groups` (
	`group_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category_id` integer NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`icon_id` integer,
	`anchorable` integer DEFAULT false NOT NULL,
	`anchored` integer DEFAULT false NOT NULL,
	`fittable_non_singleton` integer DEFAULT false NOT NULL,
	`use_base_price` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `group_name_idx` ON `groups` (`name`);--> statement-breakpoint
CREATE INDEX `group_category_id_idx` ON `groups` (`category_id`);--> statement-breakpoint
CREATE INDEX `group_published_idx` ON `groups` (`published`);