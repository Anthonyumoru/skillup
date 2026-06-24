const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PHONE = '09122274678';
const ADMIN_PASS = 'anthony';
const PRICE = 500;
const BANK = '0224926246';
const BANK_NAME = 'GTBank';

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT UNIQUE, has_paid BOOLEAN DEFAULT false, payment_code TEXT)');
  await pool.query('CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, icon TEXT)');
  await pool.query('CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, skill_id TEXT, title TEXT, question TEXT, answer TEXT)');
  await pool.query('CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, user_id TEXT, phone TEXT, amount INTEGER, code TEXT, status TEXT DEFAULT pending, created_at TIMESTAMP DEFAULT NOW())');
  await pool.query("INSERT INTO skills (id,name,icon) VALUES ('whatsapp','WhatsApp','📱'),('ai','AI Tools','🤖'),('baking','Baking','🧁') ON CONFLICT DO NOTHING");
  for(let i=1; i<=3; i++) {
    await pool.query('INSERT INTO lessons (skill_id,title,question,answer) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', ['whatsapp', 'Lesson '+i, 'Step '+i+'?', 'step'+i]);
  }
  console.log('DB OK');
}

app.post('/register', async (req,res) => {
  const phone = req.body.phone;
  let user = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
  if(user.rows.length>0) return res.json(user.rows[0]);
  const id = 'u'+Date.now();
  await pool.query('INSERT INTO users(id,phone) VALUES($1,$2)', [id,phone]);
  user = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  res.json(user.rows[0]);
});

app.post('/lessons', async (req,res) => {
  const u = await pool.query('SELECT has_paid FROM users WHERE id=$1', [req.body.user_id]);
  if(!u.rows[0] ||!u.rows[0].has_paid) return res.json({error:'Pay ₦500'});
  const data = await pool.query('SELECT * FROM lessons WHERE skill_id=$1', [req.body.skill_id]);
  res.json(data.rows);
});

app.post('/get-payment', async (req,res) => {
  const code = 'PAY'+Math.floor(100000+Math.random()*900000);
  const u = await pool.query('SELECT phone FROM users WHERE id=$1', [req.body.user_id]);
  await pool.query('UPDATE users SET payment_code=$1 WHERE id=$2', [code,req.body.user_id]);
  await pool.query('INSERT INTO payments(user_id,phone,amount,code) VALUES($1,$2,$3,$4)', [req.body.user_id,u.rows[0].phone,PRICE,code]);
  res.json({amount:PRICE,bank:BANK_NAME,account:BANK,code:code});
});

app.post('/admin-login', async (req,res) => {
  if(req.body.phone===ADMIN_PHONE && req.body.password===ADMIN_PASS) {
    const p = await pool.query("SELECT * FROM payments WHERE status='pending'");
    res.json({success:true,payments:p.rows});
  } else res.json({error:'Wrong'});
});

app.post('/verify-payment', async (req,res) => {
  const u = await pool.query('SELECT id FROM users WHERE payment_code=$1', [req.body.code]);
  if(u.rows.length===0) return res.json({error:'Invalid'});
  await pool.query('UPDATE users SET has_paid=true WHERE id=$1', [u.rows[0].id]);
  await pool.query("UPDATE payments SET status='verified' WHERE code=$1", [req.body.code]);
  res.json({success:true});
});

app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname,'public/index.html'));
});

init().then(() => app.listen(PORT, () => console.log('Server running')));
