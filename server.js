const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS
const cors = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
};
app.use(cors);

// DATABASE
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CREATE ALL TABLES + 10 SKILLS ON STARTUP
async function initDB() {
  try {
    console.log('Connecting to Postgres DB...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT,
        balance REAL DEFAULT 0,
        free_chats INTEGER DEFAULT 2,
        is_premium INTEGER DEFAULT 0,
        total_earned REAL DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT,
        icon TEXT,
        difficulty TEXT,
        total_lessons INTEGER
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        skill_id TEXT,
        title TEXT,
        content TEXT,
        question TEXT,
        correct_answer TEXT,
        lesson_order INTEGER
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons_done (
        user_id TEXT,
        lesson_id TEXT,
        PRIMARY KEY(user_id, lesson_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // 10 SKILLS - Copy this whole block
    await pool.query(`
      INSERT INTO skills (id, name, icon, difficulty, total_lessons) VALUES
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
      ON CONFLICT (id) DO NOTHING
    `);

    // Sample lessons - 3 lessons for each skill = 30 total
    await pool.query(`
      INSERT INTO lessons (id, skill_id, title, content, question, correct_answer, lesson_order) VALUES
      ('w1','whatsapp','WhatsApp Status','Post 3x daily on status','Posts per day?','3',1),
      ('w2','whatsapp','Broadcast List','Send to 256 contacts max','Max per broadcast?','256',2),
      ('w3','whatsapp','Auto Reply','Use quick replies to save time','Quick reply benefit?','Save time',3),

      ('a1','ai','ChatGPT Basics','Use ChatGPT for product descriptions','What AI writes text?','ChatGPT',1),
      ('a2','ai','Canva AI','Magic Design makes posters fast','Canva AI feature?','Magic Design',2),
      ('a3','ai','AI Images','Midjourney creates AI images','Best AI image tool?','Midjourney',3),

      ('t1','trading','Bitcoin Basics','Bitcoin supply is 21 million','Total Bitcoin?','21 million',1),
      ('t2','trading','USDT Stablecoin','1 USDT = 1 dollar','1 USDT equals?','1 dollar',2),
      ('t3','trading','Risk Mgmt','Never invest more than you can lose','Golden rule?','Don\'t overinvest',3),

      ('c1','coding','HTML Basics','HTML structures web pages','HTML means?','HyperText Markup Language',1),
      ('c2','coding','CSS Styling','CSS makes sites beautiful','CSS means?','Cascading Style Sheets',2),
      ('c3','coding','JavaScript','JS makes sites interactive','JS stands for?','JavaScript',3),

      ('b1','baking','Measuring','Use scale for accurate baking','Best tool?','Scale',1),
      ('b2','baking','Oven Temp','180°C is standard for cakes','Standard temp?','180',2),
      ('b3','baking','Mixing','Don\'t overmix cake batter','Mixing rule?','Don\'t overmix',3),

      ('tl1','tailor','Measurements','Take 3 body measurements','How many measurements?','3',1),
      ('tl2','tailor','Sewing Machine','Thread tension matters','Key setting?','Tension',2),
      ('tl3','tailor','Fabrics','Cotton shrinks when washed','Cotton behavior?','Shrinks',3),

      ('p1','phone_repair','Safety','Always remove battery first','First step?','Remove battery',1),
      ('p2','phone_repair','Tools','Use heat gun for screen','Tool for screen?','Heat gun',2),
      ('p3','phone_repair','Testing','Test before sealing phone','When to test?','Before sealing',3),

      ('g1','graphics','Color Theory','Blue = trust, Red = urgency','Red means?','Urgency',1),
      ('g2','graphics','Fonts','Use max 2 fonts per design','Max fonts?','2',2),
      ('g3','graphics','Canva','Canva is beginner friendly','Best tool?','Canva',3),

      ('s1','social_media','Posting Time','Best time: 6-9pm daily','Best time?','6-9pm',1),
      ('s2','social_media','Hashtags','Use 5-10 relevant hashtags','Hashtag count?','5-10',2),
      ('s3','social_media','Engagement','Reply to all comments','Engagement rule?','Reply all',3),

      ('ph1','photography','Lighting','Natural light is best','Best light?','Natural',1),
      ('ph2','photography','Grid','Use rule of thirds grid','Grid rule?','Rule of thirds',2),
      ('ph3','photography','Focus','Tap to focus on subject','How to focus?','Tap subject',3)
      ON CONFLICT (id) DO NOTHING
    `);

    // Bank settings
    await pool.query(`
      INSERT INTO settings (key, value) VALUES
      ('bank_account','0123456789'),
      ('bank_name','YOUR NAME HERE'),
      ('admin_key','mysecret123')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('DB ready + 10 skills + 30 lessons created ✅');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
}

initDB();

// ALL YOUR ROUTES - same as before
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/register', async (req, res) => {
  const {phone} = req.body;
  if(!phone) return res.json({error: 'Phone required'});
  try {
    await pool.query('INSERT INTO users (id, phone, free_chats) VALUES ($1,$2,2) ON CONFLICT (id) DO NOTHING', [phone, phone]);
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [phone]);
    res.json(result.rows[0]);
  } catch (err) {
    res.json({error: err.message});
  }
});

app.post('/user', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.body.user_id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.json({error: err.message});
  }
});

app.get('/skills', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM skills');
    res.json(result.rows);
  } catch (err) {
    res.json({error: err.message});
  }
});

app.post('/lessons', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, content, question FROM lessons WHERE skill_id=$1 ORDER BY lesson_order', [req.body.skill_id]);
    res.json(result.rows);
  } catch (err) {
    res.json({error: err.message});
  }
});

app.post('/submit-lesson', async (req, res) => {
  const {user_id, lesson_id, answer} = req.body;
  try {
    const done = await pool.query('SELECT * FROM lessons_done WHERE user_id=$1 AND lesson_id=$2', [user_id, lesson_id]);
    if(done.rows.length > 0) return res.json({error: 'Already completed this lesson'});

    const lesson = await pool.query('SELECT correct_answer FROM lessons WHERE id=$1', [lesson_id]);
    if(lesson.rows.length === 0) return res.json({error: 'Lesson not found'});

    if(answer.toLowerCase().trim()!== lesson.rows[0].correct_answer.toLowerCase()) {
      return res.json({error: 'Wrong answer. Try again'});
    }

    await pool.query('INSERT INTO lessons_done VALUES ($1,$2)', [user_id, lesson_id]);
    await pool.query('UPDATE users SET balance = balance + 5, total_earned = total_earned + 5 WHERE id=$1', [user_id]);

    res.json({success: true, earned: 5, msg: 'Correct! ₦5 added to balance 💰'});
  } catch (err) {
    res.json({error: err.message});
  }
});

app.get('/bank-details', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings WHERE key LIKE $1', ['bank%']);
    let obj = {};
    result.rows.forEach(r => obj[r.key] = r.value);
    res.json(obj);
  } catch (err) {
    res.json({error: err.message});
  }
});

app.get('/admin', async (req, res) => {
  const key = req.query.key;
  try {
    const keyRow = await pool.query('SELECT value FROM settings WHERE key=$1', ['admin_key']);
    if(key!== keyRow.rows[0].value) return res.send('Unauthorized. Use /admin?key=yourkey');

    const users = await pool.query('SELECT * FROM users ORDER BY balance DESC');
    const settings = await pool.query('SELECT * FROM settings');

    let html = `<h1>SkillUp Admin</h1><h2>Users: ${users.rows.length}</h2><table border=1><tr><th>Phone</th><th>Balance</th><th>Earned</th></tr>`;
    users.rows.forEach(u => html += `<tr><td>${u.phone}</td><td>₦${u.balance}</td><td>₦${u.total_earned}</td></tr>`);
    html += `</table><h2>Bank Settings</h2><form method=POST action=/admin/save><input name=bank_account value="${settings.rows.find(s=>s.key=='bank_account').value}"><input name=bank_name value="${settings.rows.find(s=>s.key=='bank_name').value}"><button>Save</button></form>`;
    res.send(html);
  } catch (err) {
    res.send('Error: ' + err.message);
  }
});

app.post('/admin/save', express.urlencoded({extended:true}), async (req, res) => {
  await pool.query('UPDATE settings SET value=$1 WHERE key=$2', [req.body.bank_account, 'bank_account']);
  await pool.query('UPDATE settings SET value=$1 WHERE key=$2', [req.body.bank_name, 'bank_name']);
  res.send('Saved! <a href="/admin?key=mysecret123">Back</a>');
});

app.listen(PORT, () => console.log(`SkillUp running on ${PORT}`));
