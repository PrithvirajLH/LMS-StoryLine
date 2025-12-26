import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, sql } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    const pool = await getPool();
    console.log('Running migrations...');

    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by GO statements (SQL Server batch separator)
    const batches = migrationSQL
      .split(/^\s*GO\s*$/gim)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);

    for (const batch of batches) {
      await pool.request().query(batch);
      console.log('Executed batch');
    }

    console.log('Migrations completed successfully');
    await sql.close();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runMigrations();


