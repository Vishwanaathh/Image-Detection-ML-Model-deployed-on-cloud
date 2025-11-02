import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASS,
  database: process.env.RDS_DB,
  ssl: { rejectUnauthorized: false },
});

const run = async () => {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      image_name TEXT,
      s3_url TEXT,
      result JSONB,
      confidence NUMERIC,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✅ Database initialized");
  await client.end();
};

run().catch(console.error);
