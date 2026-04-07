const router = require('express').Router();
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { signToken } = require('../utils/jwt');
const requireAuth = require('../middleware/auth');

const SALT_ROUNDS = 12;

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ success: false, error: 'Никнейм: от 3 до 50 символов' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Пароль: минимум 6 символов' });
    }
    const allowedRoles = ['user', 'expert'];
    const userRole = allowedRoles.includes(role) ? role : 'user';

    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email или никнейм уже заняты' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1,$2,$3,$4)
       RETURNING id, username, email, role, level, xp, streak, avatar_color, created_at`,
      [username, email, password_hash, userRole]
    );
    const user = result.rows[0];

    if (userRole === 'expert') {
      await pool.query(
        'INSERT INTO experts (user_id, specialty) VALUES ($1, $2)',
        [user.id, 'Не указано']
      );
    }

    await pool.query(
      "UPDATE platform_stats SET stat_value=stat_value+1, updated_at=NOW() WHERE stat_key='users_count'"
    );

    const token = signToken({ userId: user.id, role: user.role, username: user.username });
    setTokenCookie(res, token);
    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('register:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Введите email и пароль' });
    }
    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, level, xp, streak, avatar_color
       FROM users WHERE email=$1`, [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
    }
    const token = signToken({ userId: user.id, role: user.role, username: user.username });
    setTokenCookie(res, token);
    delete user.password_hash;
    res.json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('login:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, data: { message: 'Выход выполнен' } });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, level, xp, streak, avatar_color, created_at
       FROM users WHERE id=$1`, [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('/me:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
