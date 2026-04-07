const router = require('express').Router();
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');

// GET /api/experts
router.get('/', async (req, res) => {
  try {
    const { cat, sort, search, limit = 20, offset = 0 } = req.query;
    const lim = Math.min(parseInt(limit) || 20, 100);
    const off = parseInt(offset) || 0;
    const conds = ['e.verified=true'];
    const vals  = [];
    let i = 1;
    if (cat)    { conds.push(`e.specialty ILIKE $${i++}`); vals.push(`%${cat}%`); }
    if (search) { conds.push(`(u.username ILIKE $${i++} OR e.bio ILIKE $${i-1})`); vals.push(`%${search}%`); }
    const sortMap = { rating:'e.rating DESC', reviews:'e.reviews_count DESC', students:'e.students_count DESC', price:'e.price_consultation ASC' };
    const order = sortMap[sort] || 'e.rating DESC';
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM experts e JOIN users u ON u.id=e.user_id WHERE ${conds.join(' AND ')}`, vals
    );
    vals.push(lim, off);
    const result = await pool.query(
      `SELECT e.*, u.username, u.avatar_color, u.level
       FROM experts e JOIN users u ON u.id=e.user_id
       WHERE ${conds.join(' AND ')} ORDER BY ${order}
       LIMIT $${i++} OFFSET $${i++}`, vals
    );
    res.json({ success: true, data: result.rows, total: parseInt(countRes.rows[0].count), limit: lim, offset: off });
  } catch (err) {
    console.error('GET experts:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/experts/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const result = await pool.query(
      `SELECT e.*, u.username, u.avatar_color, u.level, u.created_at AS member_since
       FROM experts e JOIN users u ON u.id=e.user_id WHERE e.id=$1`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Эксперт не найден' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET expert:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// PUT /api/experts/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const expertId = parseInt(req.params.id);
    if (isNaN(expertId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const eRes = await pool.query('SELECT user_id FROM experts WHERE id=$1', [expertId]);
    if (eRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Профиль не найден' });
    if (eRes.rows[0].user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }
    const { specialty, bio, methods, price_consultation, price_monthly } = req.body;
    const updates = [], vals = [];
    let i = 1;
    if (specialty)               { updates.push(`specialty=$${i++}`);          vals.push(specialty); }
    if (bio !== undefined)       { updates.push(`bio=$${i++}`);                vals.push(bio); }
    if (Array.isArray(methods))  { updates.push(`methods=$${i++}`);            vals.push(methods); }
    if (price_consultation != null) { updates.push(`price_consultation=$${i++}`); vals.push(parseFloat(price_consultation)); }
    if (price_monthly != null)   { updates.push(`price_monthly=$${i++}`);      vals.push(parseFloat(price_monthly)); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'Нет данных' });
    vals.push(expertId);
    const result = await pool.query(`UPDATE experts SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT expert:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/experts/:id/book
router.post('/:id/book', requireAuth, async (req, res) => {
  try {
    const expertId = parseInt(req.params.id);
    if (isNaN(expertId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const eRes = await pool.query(
      'SELECT e.user_id, u.username FROM experts e JOIN users u ON u.id=e.user_id WHERE e.id=$1', [expertId]
    );
    if (eRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Эксперт не найден' });
    await pool.query(
      "INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'booking')",
      [eRes.rows[0].user_id, 'Новая запись!', `@${req.user.username} хочет записаться к вам.`]
    );
    res.json({ success: true, data: { message: 'Запрос отправлен эксперту.' } });
  } catch (err) {
    console.error('book:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/experts/:id/reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const result = await pool.query(
      `SELECT er.*, u.username, u.avatar_color FROM expert_reviews er
       JOIN users u ON u.id=er.user_id WHERE er.expert_id=$1 ORDER BY er.created_at DESC`, [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('expert reviews:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/experts/:id/reviews
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const expertId = parseInt(req.params.id);
    const userId   = req.user.userId;
    if (isNaN(expertId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const { rating, text } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, error: 'Оценка от 1 до 5' });
    await pool.query(
      'INSERT INTO expert_reviews (expert_id, user_id, rating, text) VALUES ($1,$2,$3,$4)',
      [expertId, userId, parseInt(rating), text || null]
    );
    const avgRes = await pool.query(
      'SELECT AVG(rating) AS avg, COUNT(*) AS cnt FROM expert_reviews WHERE expert_id=$1', [expertId]
    );
    await pool.query(
      'UPDATE experts SET rating=$1, reviews_count=$2 WHERE id=$3',
      [parseFloat(avgRes.rows[0].avg).toFixed(2), parseInt(avgRes.rows[0].cnt), expertId]
    );
    res.status(201).json({ success: true, data: { message: 'Отзыв добавлен' } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Вы уже оставили отзыв' });
    console.error('expert review:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
