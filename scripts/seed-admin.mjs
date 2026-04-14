import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

// Load DATABASE_URL from environment (injected by the platform)
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const EMAIL = "aaron.anderson62901@gmail.com";
const PASSWORD = "Yvngbutta32!";
const NAME = "Aaron Anderson";

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  const hash = await bcrypt.hash(PASSWORD, 12);
  const openId = `email:${EMAIL}`;

  // Check if user already exists
  const [rows] = await conn.execute("SELECT id, role FROM users WHERE email = ?", [EMAIL]);

  if (rows.length > 0) {
    await conn.execute(
      "UPDATE users SET passwordHash = ?, role = 'admin', openId = ?, loginMethod = 'email' WHERE email = ?",
      [hash, openId, EMAIL]
    );
    console.log(`✓ Updated ${EMAIL} — role=admin, password set`);
  } else {
    await conn.execute(
      "INSERT INTO users (openId, name, email, loginMethod, passwordHash, role, lastSignedIn) VALUES (?, ?, ?, 'email', ?, 'admin', NOW())",
      [openId, NAME, EMAIL, hash]
    );
    console.log(`✓ Created admin user ${EMAIL}`);
  }

  await conn.end();
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
