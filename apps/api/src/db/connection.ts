import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { appConfig } from "../config.js";

mkdirSync(dirname(appConfig.dbPath), { recursive: true });

export const db = new Database(appConfig.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
