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
