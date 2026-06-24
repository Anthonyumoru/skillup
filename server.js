const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT UNIQUE, balance INTEGER DEFAULT 0, free_chats INTEGER DEFAULT 2, total_earned INTEGER DEFAULT 0, premium BOOLEAN DEFAULT false)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, icon TEXT, difficulty TEXT, total_lessons INTEGER)`);

  await pool.query(`DROP TABLE IF EXISTS lessons CASCADE`);
  await pool.query(`CREATE TABLE lessons (id SERIAL PRIMARY KEY, skill_id TEXT, title TEXT, content TEXT, question TEXT, answer TEXT)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS user_progress (id SERIAL PRIMARY KEY, user_id TEXT, lesson_id INTEGER, completed BOOLEAN)`);

  await pool.query(`INSERT INTO skills (id, name, icon, difficulty, total_lessons) VALUES
    ('whatsapp','WhatsApp Marketing','📱','Beginner',3),
    ('ai','AI Tools','🤖','Beginner',3),
    ('trading','Crypto Trading','💰','Intermediate',3),
    ('coding','Web Development','💻','Intermediate',3),
    ('baking','Baking & Pastries','🧁','Beginner',3),
    ('tailor','Fashion & Tailoring','✂️','Beginner',3),
    ('phone_repair','Phone Repair','🔧','Advanced',3),
    ('graphics','Graphic Design','🎨','Beginner',3),
    ('social_media','Social Media Mgmt','📊','Beginner',3),
    ('photography','Mobile Photography','📸','Beginner',3)
    ON CONFLICT (id) DO NOTHING`);

  for(const skill of ['whatsapp','ai','trading','coding','baking','tailor','phone_repair','graphics','social_media','photography']) {
    for(let i=1; i<=3; i++) {
      await pool.query(`INSERT INTO lessons (skill_id, title, content, question, answer) VALUES ($1, $2, $3, $4, $5)`,
        [skill, `Lesson ${i}`, `Step ${i} for ${skill}`, `What is step ${i}?`, `step${i}`]);
    }
  }
  console.log('Database ready ✅');
}
initDB().catch(console.error);

// APIs
app.post('/register', async (req, res) => {
  const { phone } = req.body;
  const id = 'user_' + Date.now();
  await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET phone=users.phone', [id, phone]);
  const user = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  res.json(user.rows[0]);
});

app.post('/user', async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.body.user_id]);
  res.json(result.rows[0] || { error: 'User not found' });
});

app.get('/skills', async (req, res) => {
  const result = await pool.query('SELECT * FROM skills ORDER BY name');
  res.json(result.rows);
});

app.post('/lessons', async (req, res) => {
  const result = await pool.query('SELECT id, skill_id, title, content, question FROM lessons WHERE skill_id = $1', [req.body.skill_id]);
  res.json(result.rows);
});

app.post('/submit-lesson', async (req, res) => {
  const { user_id, lesson_id } = req.body;
  const check = await pool.query('SELECT * FROM user_progress WHERE user_id = $1 AND lesson_id = $2', [user_id, lesson_id]);
  if(check.rows.length > 0) return res.json({ error: 'Already done' });
  await pool.query('INSERT INTO user_progress (user_id, lesson_id, completed) VALUES ($1, $2, true)', [user_id, lesson_id]);
  await pool.query('UPDATE users SET balance = balance + 5, total_earned = total_earned + 5, free_chats = GREATEST(free_chats - 1, 0) WHERE id = $1', [user_id]);
  res.json({ success: true, msg: '₦5 added! ✅' });
});

app.get('/bank-details', (req, res) => {
  res.json({ bank_account: '0123456789', bank_name: 'SkillUp Tech Ltd' });
});

// ADDED: Admin route so /admin doesn't 404
app.get('/admin', (req, res) => {
  if(req.query.key!== 'mysecret123') return res.send('Access denied');
  res.send('<h1>SkillUp Admin</h1><p>Users and data will show here later</p>');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => console.log(`SkillUp running on port ${PORT}`));
