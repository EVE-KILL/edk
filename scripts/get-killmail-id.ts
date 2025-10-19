import { db } from "../app/db";
import { killmails } from "../app/db/schema";

const result = await db.select({ killmailId: killmails.killmailId }).from(killmails).limit(1);
console.log(result[0]?.killmailId || "No killmails found");
process.exit(0);
