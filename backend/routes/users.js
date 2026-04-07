const router = require('express').Router();
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const result = await pool.query(
      'SELECT id, username, role, level, xp, streak, avatar_color, created_at FROM users WHERE id=$1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET user:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    if (req.user.userId !== id) return res.status(403).json({ success: false, error: 'Нельзя редактировать чужой профиль' });

    const { username, avatar_color } = req.body;
    const updates = [], values = [];
    let i = 1;
    if (username) {
      if (username.length < 3 || username.length > 50) return res.status(400).json({ success: false, error: 'Никнейм: от 3 до 50 символов' });
      updates.push(`username=$${i++}`); values.push(username);
    }
    if (avatar_color) { updates.push(`avatar_color=$${i++}`); values.push(avatar_color); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
    updates.push('updated_at=NOW()');
    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(',')} WHERE id=$${i} RETURNING id, username, email, role, level, xp, streak, avatar_color`,
      values
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Никнейм уже занят' });
    console.error('PUT user:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// PUT /api/users/:id/password
router.put('/:id/password', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    if (req.user.userId !== id) return res.status(403).json({ success: false, error: 'Нельзя менять чужой пароль' });
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ success: false, error: 'Укажите старый и новый пароль' });
    if (new_password.length < 6) return res.status(400).json({ success: false, error: 'Новый пароль: минимум 6 символов' });
    const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    const ok = await bcrypt.compare(old_password, result.rows[0].password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Старый пароль неверный' });
    const new_hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [new_hash, id]);
    res.json({ success: true, data: { message: 'Пароль изменён' } });
  } catch (err) {
    console.error('PUT password:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// DELETE /api/users/:id — запрос на удаление (не удаляем сразу)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    if (req.user.userId !== id) return res.status(403).json({ success: false, error: 'Нельзя удалить чужой аккаунт' });
    const { reason } = req.body;
    await pool.query(
      'INSERT INTO account_deletion_requests (user_id, reason) VALUES ($1,$2)',
      [id, reason || null]
    );
    res.json({ success: true, data: { message: 'Заявка отправлена. Ответим в течение 3 дней.' } });
  } catch (err) {
    console.error('DELETE user:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/users/:id/stats
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });

    const userRes = await pool.query('SELECT level, xp, streak FROM users WHERE id=$1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    const user = userRes.rows[0];

    const questsRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='completed') AS quests_completed,
         COUNT(*) FILTER (WHERE status='active')    AS quests_active
       FROM user_quests WHERE user_id=$1`, [id]
    );

    const activityRes = await pool.query(
      `SELECT qc.checked_at::text AS date,
              SUM(q.xp_reward / NULLIF(q.duration_days, 0)) AS xp
       FROM quest_checkins qc
       JOIN user_quests uq ON uq.id = qc.user_quest_id
       JOIN quests q ON q.id = uq.quest_id
       WHERE uq.user_id=$1 AND qc.checked_at >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY qc.checked_at ORDER BY qc.checked_at`, [id]
    );

    const catRes = await pool.query(
      `SELECT q.category, COUNT(*) AS count
       FROM user_quests uq JOIN quests q ON q.id=uq.quest_id
       WHERE uq.user_id=$1 GROUP BY q.category ORDER BY count DESC`, [id]
    );
    const total = catRes.rows.reduce((s, r) => s + parseInt(r.count), 0);
    const by_category = catRes.rows.map(r => ({
      category: r.category,
      count: parseInt(r.count),
      pct: total > 0 ? Math.round(parseInt(r.count) / total * 100) : 0,
    }));

    res.json({ success: true, data: {
      total_xp:        parseInt(user.xp),
      level:           parseInt(user.level),
      current_streak:  parseInt(user.streak),
      quests_completed: parseInt(questsRes.rows[0].quests_completed),
      quests_active:   parseInt(questsRes.rows[0].quests_active),
      activity_by_day: activityRes.rows,
      by_category,
    }});
  } catch (err) {
    console.error('user stats:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
