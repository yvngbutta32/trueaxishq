import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const EMAIL = "aaron.anderson62901@gmail.com";
const PASSWORD = "Yvngbutta32!";
const NAME = "Aaron Anderson";
const ROLE = "admin";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    // Check if user already exists
    const [existing] = await connection.execute(
      "SELECT id, email, role FROM users WHERE email = ?",
      [EMAIL]
    );

    if (existing.length > 0) {
      const user = existing[0];
      console.log(`User already exists (id=${user.id}, role=${user.role}). Updating password and setting role to admin...`);
      const hashedPassword = await bcrypt.hash(PASSWORD, 12);
      await connection.execute(
        "UPDATE users SET passwordHash = ?, role = ?, name = ?, loginMethod = 'email' WHERE email = ?",
        [hashedPassword, ROLE, NAME, EMAIL]
      );
      console.log(`✅ Admin account updated: ${EMAIL}`);
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(PASSWORD, 12);
      const [result] = await connection.execute(
        "INSERT INTO users (name, email, passwordHash, role, loginMethod, createdAt) VALUES (?, ?, ?, ?, 'email', ?)",
        [NAME, EMAIL, hashedPassword, ROLE, Date.now()]
      );
      console.log(`✅ Admin account created: ${EMAIL} (id=${result.insertId})`);
    }

    // Verify the account
    const [verify] = await connection.execute(
      "SELECT id, name, email, role FROM users WHERE email = ?",
      [EMAIL]
    );
    console.log("Account details:", verify[0]);

  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
