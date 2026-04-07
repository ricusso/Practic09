const router = require('express').Router();
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');

router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ success: false, error: 'Укажите тему и сообщение' });
    if (subject.length > 255) return res.status(400).json({ success: false, error: 'Тема слишком длинная' });
    if (message.length < 10)  return res.status(400).json({ success: false, error: 'Сообщение слишком короткое' });

    const result = await pool.query(
      'INSERT INTO support_tickets (user_id, subject, message) VALUES ($1,$2,$3) RETURNING *',
      [req.user.userId, subject, message]
    );
    await pool.query(
      "INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'support')",
      [req.user.userId, 'Обращение принято', `Тикет #${result.rows[0].id} получен. Ответим в течение 24 часов.`]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('support ticket:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
