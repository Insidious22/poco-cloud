import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { appConfig } from "../config.js";

mkdirSync(dirname(appConfig.dbPath), { recursive: true });

export const db = new DatabaseSync(appConfig.dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
