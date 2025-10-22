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