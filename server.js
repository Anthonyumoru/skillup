const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// YOUR DETAILS - CHANGE THESE
const ADMIN_PHONE = '09122274678';
const ADMIN_PASS = 'anthony';
const COURSE_PRICE = 500;
const BANK_ACCOUNT = '0224926246';
const BANK_NAME = 'GTBank';

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create tables on startup
async function initDB() {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT UNIQUE, has_paid BOOLEAN DEFAULT false, payment_code TEXT)');
    await pool.query('CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, icon TEXT)');
    await pool.query('CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, skill_id TEXT, title TEXT, question TEXT, answer TEXT)');
    await pool.query('CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, user_id TEXT, phone TEXT, amount INTEGER, code TEXT, status TEXT, created_at TIMESTAMP DEFAULT NOW())');

    await pool.query("INSERT INTO skills (id, name, icon) VALUES ('whatsapp','WhatsApp Marketing','📱'),('ai','AI Tools','🤖'),('baking','Baking','🧁'),('tailor','Tailoring','✂️'),('graphics','Graphics','🎨') ON CONFLICT DO NOTHING");

    for(const skill of ['whatsapp','ai','baking','tailor','graphics']) {
      for(let i=1; i<=3; i++) {
        await pool.query('INSERT INTO lessons (skill_id, title, question, answer) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [skill, 'Lesson ' + i, 'What is step ' + i + ' for ' + skill + '?', 'step' + i]);
      }
    }
    console.log('DB Ready ✅');
  } catch(err) {
    console.log('DB Error:', err.message);
  }
}

// User APIs
app.post('/register', async (req, res) => {
  try {
    const { phone } = req.body;
    if(!phone) return res.status(400).json({error: 'Phone required'});

    // Check if user exists first - no ON CONFLICT needed
    const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if(existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    // If not exists, create new
    const id = 'u' + Date.now();
    await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2)', [id, phone]);
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    res.json(user.rows[0]);
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/user', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.body.user_id]);
    res.json(result.rows[0]);
  } catch(err) {
    res.status(500).json({error:
