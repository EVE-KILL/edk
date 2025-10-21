ALTER TABLE `solar_systems` ADD `region_id` integer;--> statement-breakpoint
CREATE INDEX `solar_system_region_id_idx` ON `solar_systems` (`region_id`);