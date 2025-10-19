CREATE TABLE `solar_systems` (
	`system_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`constellation_id` integer NOT NULL,
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
CREATE INDEX `solar_system_security_status_idx` ON `solar_systems` (`security_status`);--> statement-breakpoint
CREATE INDEX `solar_system_updated_at_idx` ON `solar_systems` (`updated_at`);--> statement-breakpoint
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
CREATE INDEX `type_updated_at_idx` ON `types` (`updated_at`);