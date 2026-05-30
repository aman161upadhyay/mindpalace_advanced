const fs = require("node:fs");
const path = require("node:path");
const { neon } = require("@neondatabase/serverless");

function readEnv(filePath) {
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
      const key = line.slice(0, index);
      const value = line.slice(index + 1).replace(/^["']|["']$/g, "");
      return [key, value];
      }),
  );
}

async function main() {
  const root = process.cwd();
  const env = readEnv(path.join(root, ".env.local"));

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env.local");
  }

  const sql = neon(env.DATABASE_URL);
  const migration = fs.readFileSync(path.join(root, "drizzle", "0001_init.sql"), "utf8");

  for (const statement of migration
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)) {
    await sql.query(statement);
  }

  const rows = await sql.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );

  console.log(`Tables: ${rows.map((row) => row.table_name).join(", ")}`);
}

main().catch((error) => {
  console.error(`Migration failed: ${error.name || "Error"}`);
  process.exit(1);
});
