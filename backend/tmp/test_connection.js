const { Pool } = require('pg');

const conn1 = "postgresql://postgres.tagdkjncplvuudjjklhm:@Bulaipass46@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";
const conn2 = "postgresql://postgres.tagdkjncplvuudjjklhm:%40Bulaipass46@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";

async function test(connectionString, name) {
  console.log(`Testing ${name}...`);
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`${name} SUCCESS:`, res.rows[0]);
  } catch (err) {
    console.error(`${name} FAILED:`, err.message);
  } finally {
    await pool.end();
  }
}

async function run() {
  await test(conn1, "Unencoded Password");
  await test(conn2, "Encoded Password");
}

run();
