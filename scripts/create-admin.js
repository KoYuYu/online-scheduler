const crypto = require("node:crypto");
const { Pool } = require("pg");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run admin:create -- admin@example.com password");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required to create a Postgres admin user.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `INSERT INTO admin_users (id, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [crypto.randomUUID(), email.toLowerCase(), hashPassword(password)]
  );
  await pool.end();
  console.log(`Admin user ready: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
