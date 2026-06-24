const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// YOUR DETAILS
const ADMIN_PHONE = '09122274678';
const ADMIN_PASS = 'anthony';
const COURSE_PRICE = 500;
const BANK_ACCOUNT = '0224926246';
const BANK_NAME = 'GTBank';

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'? { rejectUnauthorized: false } : false
});

// Wait for DB before starting server
async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT UNIQUE, has_paid BOOLEAN DEFAULT false, payment_code TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, icon TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, skill_id TEXT, title TEXT, question TEXT, answer TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, user_id TEXT, phone TEXT, amount INTEGER, code TEXT, status TEXT, created_at TIMESTAMP DEFAULT NOW())`);

    await pool.query(`INSERT INTO skills VALUES
    ('whatsapp','WhatsApp Marketing','📱'),
    ('ai','AI Tools','🤖'),
    ('baking','Baking','🧁'),
    ('tailor','Tailoring','✂️'),
    ('graphics','Graphics','🎨')
    ON CONFLICT DO NOTHING`);

    for(const skill of ['whatsapp','ai','baking','tailor','graphics']) {
      for(let i=1; i<=3; i++) {
        await pool.query(`INSERT INTO lessons (skill_id, title, question, answer) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [skill, `Lesson ${i}`, `What is step ${i} for ${skill}?`, `step${i}`]);
      }
    }
    console.log('DB Ready ✅');
  } catch(err) {
    console.log('DB Error:', err.message);
  }
}

// User APIs with error handling
app.post('/register', async (req, res) => {
  try {
    const { phone } = req.body;
    if(!phone) return res.status(400).json({error: 'Phone required'});
    const id = 'u' + Date.now();
    await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2) ON CONFLICT (phone) DO NOTHING', [id, phone]);
    const user = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
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
    res.status(500).json({error: err.message});
  }
});

app.get('/skills', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM skills');
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/lessons', async (req, res) => {
  try {
    const user = await pool.query('SELECT has_paid FROM users WHERE id = $1', [req.body.user_id]);
    if(!user.rows[0]) return res.json({ error: 'User not found' });
    if(!user.rows[0].has_paid) return res.json({ error: 'Pay ₦500 to unlock' });
    const result = await pool.query('SELECT * FROM lessons WHERE skill_id = $1', [req.body.skill_id]);
    res.json(result.rows);
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/get-payment', async (req, res) => {
  try {
    const code = 'PAY' + Math.floor(100000 + Math.random() * 900000);
    const user = await pool.query('SELECT phone FROM users WHERE id = $1', [req.body.user_id]);
    await pool.query('UPDATE users SET payment_code = $1 WHERE id = $2', [code, req.body.user_id]);
    await pool.query('INSERT INTO payments (user_id, phone, amount, code, status) VALUES ($1, $2, $3, $4, $5)',
      [req.body.user_id, user.rows[0].phone, COURSE_PRICE, code, 'pending']);
    res.json({ amount: COURSE_PRICE, bank: BANK_NAME, account: BANK_ACCOUNT, code: code });
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/submit', async (req, res) => {
  res.json({ success: true, msg: 'Lesson completed!' });
});

// ADMIN APIs
app.post('/admin-login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if(phone === ADMIN_PHONE && password === ADMIN_PASS) {
      const pending = await pool.query("SELECT * FROM payments WHERE status = 'pending' ORDER BY id DESC");
      res.json({ success: true, payments: pending.rows });
    } else {
      res.json({ error: 'Invalid admin login' });
    }
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/verify-payment', async (req, res) => {
  try {
    const { code } = req.body;
    const user = await pool.query('SELECT id FROM users WHERE payment_code = $1', [code]);
    if(user.rows.length === 0) return res.json({ error: 'Invalid code' });
    await pool.query('UPDATE users SET has_paid = true WHERE id = $1', [user.rows[0].id]);
    await pool.query('UPDATE payments
