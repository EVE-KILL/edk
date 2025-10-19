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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_killmails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`killmail_id` integer NOT NULL,
	`hash` text NOT NULL,
	`killmail_time` integer NOT NULL,
	`solar_system_id` integer NOT NULL,
	`attacker_count` integer DEFAULT 0 NOT NULL,
	`total_value` text DEFAULT '0' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`is_solo` integer DEFAULT false NOT NULL,
	`is_npc` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_killmails`("id", "killmail_id", "hash", "killmail_time", "solar_system_id", "attacker_count", "total_value", "points", "is_solo", "is_npc", "created_at", "updated_at") SELECT "id", "killmail_id", "hash", "killmail_time", "solar_system_id", "attacker_count", "total_value", "points", "is_solo", "is_npc", "created_at", "updated_at" FROM `killmails`;--> statement-breakpoint
DROP TABLE `killmails`;--> statement-breakpoint
ALTER TABLE `__new_killmails` RENAME TO `killmails`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `killmails_killmail_id_unique` ON `killmails` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `killmail_killmail_id_idx` ON `killmails` (`killmail_id`);--> statement-breakpoint
CREATE INDEX `killmail_time_idx` ON `killmails` (`killmail_time`);--> statement-breakpoint
CREATE INDEX `killmail_solar_system_id_idx` ON `killmails` (`solar_system_id`);--> statement-breakpoint
CREATE INDEX `killmail_is_solo_idx` ON `killmails` (`is_solo`);--> statement-breakpoint
CREATE INDEX `killmail_is_npc_idx` ON `killmails` (`is_npc`);--> statement-breakpoint
CREATE INDEX `killmail_total_value_idx` ON `killmails` (`total_value`);