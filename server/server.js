import express from "express";
import cors from "cors";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  // Create tables if they don't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      game TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS scores_game_idx ON scores(game);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS snake_meta (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      essence INTEGER NOT NULL DEFAULT 0,
      upgrades JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("DB ready");
}
initDb().catch(e => {
  console.error("DB init failed:", e);
  process.exit(1);
});

const app = express();
app.use(morgan("tiny"));
app.use(express.json());
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true
}));

// Helpers
function sign(user) {
  return jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth routes
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: "username, email, password required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users(username, email, password_hash) VALUES ($1,$2,$3) RETURNING id, username, email, created_at",
      [username, email, hash]
    );
    const user = result.rows[0];
    const token = sign(user);
    res.json({ token, user });
  } catch (e) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = sign(user);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, created_at: user.created_at } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, email, created_at FROM users WHERE id=$1", [req.user.id]);
    res.json({ user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Scores
app.get("/api/scores", async (req, res) => {
  const { game } = req.query;
  try {
    const rows = game
      ? (await pool.query("SELECT s.id, s.game, s.score, s.created_at, u.username FROM scores s JOIN users u ON u.id=s.user_id WHERE game=$1 ORDER BY score DESC, created_at ASC LIMIT 25", [game])).rows
      : (await pool.query("SELECT s.id, s.game, s.score, s.created_at, u.username FROM scores s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 50")).rows;
    res.json({ scores: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/scores", auth, async (req, res) => {
  const { game, score } = req.body || {};
  if (!game || typeof score !== "number") return res.status(400).json({ error: "game and numeric score required" });
  try {
    const result = await pool.query("INSERT INTO scores(user_id, game, score) VALUES ($1,$2,$3) RETURNING *", [req.user.id, game, score]);
    res.json({ saved: result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Snake meta progression
const SHOP_ITEMS = {
  food_bonus: { baseCost: 150, maxLevel: 3 },
  extra_life: { baseCost: 600, maxLevel: 1 },
  start_relic: { baseCost: 450, maxLevel: 1 },
  hazard_insight: { baseCost: 300, maxLevel: 2 },
};

function costForLevel(item, currentLevel) {
  return item.baseCost * (currentLevel + 1);
}

async function ensureSnakeMeta(userId) {
  const result = await pool.query(
    `INSERT INTO snake_meta(user_id, essence, upgrades) VALUES ($1,0,'{}')
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING user_id, essence, upgrades`,
    [userId]
  );
  return result.rows[0];
}

app.get("/api/snake/meta", auth, async (req, res) => {
  try {
    const meta = await ensureSnakeMeta(req.user.id);
    res.json({ meta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/snake/meta/earn", auth, async (req, res) => {
  const { earned } = req.body || {};
  const value = Number.isFinite(earned) ? Math.max(0, Math.floor(earned)) : null;
  if (value == null) return res.status(400).json({ error: "earned must be a number" });
  try {
    const meta = await ensureSnakeMeta(req.user.id);
    const result = await pool.query(
      "UPDATE snake_meta SET essence = essence + $1, updated_at = NOW() WHERE user_id=$2 RETURNING user_id, essence, upgrades",
      [value, req.user.id]
    );
    res.json({ meta: result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/snake/meta/purchase", auth, async (req, res) => {
  const { upgradeKey } = req.body || {};
  if (!upgradeKey || !SHOP_ITEMS[upgradeKey]) {
    return res.status(400).json({ error: "Unknown upgrade" });
  }
  try {
    const meta = await ensureSnakeMeta(req.user.id);
    const upgrades = meta.upgrades || {};
    const currentLevel = upgrades[upgradeKey] || 0;
    const item = SHOP_ITEMS[upgradeKey];
    if (currentLevel >= item.maxLevel) {
      return res.status(400).json({ error: "Upgrade already maxed" });
    }
    const cost = costForLevel(item, currentLevel);
    if (meta.essence < cost) {
      return res.status(400).json({ error: "Not enough essence" });
    }
    const newLevel = currentLevel + 1;
    const newUpgrades = { ...upgrades, [upgradeKey]: newLevel };
    const result = await pool.query(
      "UPDATE snake_meta SET essence = essence - $1, upgrades = $2, updated_at = NOW() WHERE user_id=$3 RETURNING user_id, essence, upgrades",
      [cost, newUpgrades, req.user.id]
    );
    res.json({ meta: result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Static frontend (built by Vite) ---
const distPath = path.resolve(__dirname, "../client/dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  // Allow /api/* to 404 API, not index.html
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
