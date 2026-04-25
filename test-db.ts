import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon('postgresql://neondb_owner:npg_vAP1FZc6UJuN@ep-wild-rain-ajyxhb4q.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require');
const db = drizzle(sql);

async function main() {
  const users = await db.execute('SELECT * FROM users');
  console.log("Users:", users.rows);
  const tokens = await db.execute('SELECT * FROM api_tokens');
  console.log("Tokens:", tokens.rows);
}

main().catch(console.error);
