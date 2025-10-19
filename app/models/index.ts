/**
 * Model exports
 * Central location for all models
 */

export { BaseModel } from "./base-model";
export { KillmailModel, Killmails } from "./killmail";

// Re-export types from schema
export type { Killmail, NewKillmail } from "../db/schema/killmails";
