const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./skillup.db');

// Create all tables + sample data
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT, balance REAL DEFAULT 0, free_chats INTEGER DEFAULT 2, is_premium INTEGER DEFAULT 0, total_earned REAL DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT, icon TEXT, difficulty TEXT, total_lessons INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, skill_id TEXT, title TEXT, content TEXT, question TEXT, correct_answer TEXT, lesson_order INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS lessons_done (user_id TEXT, lesson_id TEXT, PRIMARY KEY(user_id, lesson_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

  // Sample skills
  db.run(`INSERT OR IGNORE INTO skills VALUES
  ('whatsapp','WhatsApp Marketing','📱','Beginner',2),
  ('ai','AI Tools','🤖','Beginner',2),
  ('trading','Crypto Basics','💰','Beginner',2)`);

  // Sample lessons
  db.run(`INSERT OR IGNORE INTO lessons VALUES
  ('w1','whatsapp','Lesson 1: WhatsApp Status','Post 3 times daily on status to get customers','How many times post daily?','3',1),
  ('w2','whatsapp','Lesson 2: Broadcast','Use broadcast to send to 256 people','Max per broadcast?','256',2),
  ('a1','ai','Lesson 1: ChatGPT','Use ChatGPT for product descriptions','What AI writes text?','ChatGPT',1),
  ('a2','ai','Lesson 2: Canva AI','Canva Magic Design makes posters fast','Canva AI feature?','Magic Design',2),
  ('c1','trading','Lesson 1: Bitcoin','Bitcoin supply is 21 million','Total Bitcoin?','21 million',1),
  ('c2','trading','Lesson 2: USDT','1 USDT = 1 dollar','1 USDT equals?','1 dollar',2)`);

  // Default bank settings
  db.run(`INSERT OR IGNORE INTO settings VALUES ('bank_account','0123456789')`);
  db.run(`INSERT OR IGNORE INTO settings VALUES ('bank_name','YOUR NAME HERE')`);
  db.run(`INSERT OR IGNORE INTO settings VALUES ('admin_key','mysecret123')`);
});

const cors = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
};

app.get('/', cors, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Register/Login
app.post('/register', cors, (req, res) => {
  const {phone} = req.body;
  if(!phone) return res.json({error: 'Phone required'});
  db.run('INSERT OR IGNORE INTO users (id, phone, free_chats) VALUES (?,?,2)', [phone, phone]);
  db.get('SELECT * FROM users WHERE id=?', [phone], (err, user) => res.json(user));
});

// Get user data
app.post('/user', cors, (req, res) => {
  db.get('SELECT * FROM users WHERE id=?', [req.body.user_id], (err, user) => res.json(user));
});

// Get skills
app.get('/skills', cors, (req, res) => {
  db.all('SELECT * FROM skills', [], (err, rows) => res.json(rows));
});

// Get lessons
app.post('/lessons', cors, (req, res) => {
  db.all('SELECT id, title, content, question FROM lessons WHERE skill_id=? ORDER BY lesson_order', [req.body.skill_id], (err, rows) => res.json(rows));
});

// Submit lesson + earn ₦5
app.post('/submit-lesson', cors, (req, res) => {
  const {user_id, lesson_id, answer} = req.body;
  db.get('SELECT * FROM lessons_done WHERE user_id=? AND lesson_id=?', [user_id, lesson_id], (err, done) => {
    if(done) return res.json({error: 'Already completed this lesson'});
    db.get('SELECT correct_answer FROM lessons WHERE id=?', [lesson_id], (err, lesson) => {
      if(!lesson) return res.json({error: 'Lesson not found'});
      if(answer.toLowerCase().trim()!== lesson.correct_answer.toLowerCase()) return res.json({error: 'Wrong answer. Try again'});
      db.serialize(() => {
        db.run('INSERT INTO lessons_done VALUES (?,?)', [user_id, lesson_id]);
        db.run('UPDATE users SET balance = balance + 5, total_earned = total_earned + 5 WHERE id=?', [user_id]);
      });
      res.json({success: true, earned: 5, msg: 'Correct! ₦5 added to balance 💰'});
    });
  });
});

// Get bank details for upgrade
app.get('/bank-details', cors, (req, res) => {
  db.all('SELECT * FROM settings WHERE key LIKE "bank%"', [], (err, rows) => {
    let obj = {};
    rows.forEach(r => obj[r.key] = r.value);
    res.json(obj);
  });
});

// Admin panel
app.get('/admin', cors, (req, res) => {
  const key = req.query.key;
  db.get('SELECT value FROM settings WHERE key="admin_key"', [], (err, row) => {
    if(key!== row.value) return res.send('Unauthorized. Use /admin?key=yourkey');
    db.all('SELECT * FROM users ORDER BY balance DESC', [], (err, users) => {
      db.all('SELECT * FROM settings', [], (err, settings) => {
        let html = `<h1>SkillUp Admin</h1><h2>Users: ${users.length}</h2><table border=1><tr><th>Phone</th><th>Balance</th><th>Earned</th></tr>`;
        users.forEach(u => html += `<tr><td>${u.phone}</td><td>₦${u.balance}</td><td>₦${u.total_earned}</td></tr>`);
        html += `</table><h2>Bank Settings</h2><form method=POST action=/admin/save><input name=bank_account value="${settings.find(s=>s.key=='bank_account').value}"><input name=bank_name value="${settings.find(s=>s.key=='bank_name').value}"><button>Save</button></form>`;
        res.send(html);
      });
    });
  });
});

app.post('/admin/save', express.urlencoded({extended:true}), (req, res) => {
  db.run('UPDATE settings SET value=? WHERE key="bank_account"', [req.body.bank_account]);
  db.run('UPDATE settings SET value=? WHERE key="bank_name"', [req.body.bank_name]);
  res.send('Saved! <a href="/admin?key=mysecret123">Back</a>');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SkillUp running on ${port}`));
