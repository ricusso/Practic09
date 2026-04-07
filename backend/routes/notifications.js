const router = require('express').Router();
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id=$1 AND read=false', [req.user.userId]
    );
    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.userId]);
    res.json({ success: true, data: { message: 'Все прочитаны' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const result = await pool.query(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2 RETURNING *', [id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Не найдено' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
