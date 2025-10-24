CREATE INDEX `victim_ship_killmail_idx` ON `victims` (`ship_type_id`,`killmail_id`);--> statement-breakpoint
CREATE INDEX `attacker_character_killmail_idx` ON `attackers` (`character_id`,`killmail_id`);--> statement-breakpoint
CREATE INDEX `attacker_corporation_killmail_idx` ON `attackers` (`corporation_id`,`killmail_id`);--> statement-breakpoint
CREATE INDEX `attacker_alliance_killmail_idx` ON `attackers` (`alliance_id`,`killmail_id`);--> statement-breakpoint
CREATE INDEX `attacker_ship_killmail_idx` ON `attackers` (`ship_type_id`,`killmail_id`);