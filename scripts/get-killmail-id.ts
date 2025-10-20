import { db } from "../src/db";
import { killmails } from "../db/schema";

const result = await db.select({ killmailId: killmails.killmailId }).from(killmails).limit(1);
console.log(result[0]?.killmailId || "No killmails found");
process.exit(0);
