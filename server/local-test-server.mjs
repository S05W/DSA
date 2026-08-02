import { resolve } from "node:path";

process.env.DATABASE_PATH = process.env.DATABASE_PATH ?? resolve("data/local-test.db");
await import("./server.mjs");
