DROP MATERIALIZED VIEW IF EXISTS top_characters_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_corporations_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_alliances_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_systems_weekly;
DROP MATERIALIZED VIEW IF EXISTS top_regions_weekly;
DROP VIEW IF EXISTS kill_list;

DROP INDEX IF EXISTS idx_killmails_top_attacker_char;
DROP INDEX IF EXISTS idx_killmails_top_attacker_corp;
DROP INDEX IF EXISTS idx_killmails_top_attacker_ally;
DROP INDEX IF EXISTS idx_killmails_victim_char_time;
DROP INDEX IF EXISTS idx_killmails_victim_corp_time;
DROP INDEX IF EXISTS idx_killmails_victim_ally_time;
DROP INDEX IF EXISTS idx_killmails_victim_ship_type_time;
DROP INDEX IF EXISTS idx_killmails_value_time;
DROP INDEX IF EXISTS idx_killmails_npc_time;
DROP INDEX IF EXISTS idx_killmails_solo_time;
DROP INDEX IF EXISTS idx_killmails_time_attackers;
