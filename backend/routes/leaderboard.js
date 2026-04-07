const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/leaderboard/top3 — ВАЖНО: до /:period
router.get('/top3', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.username, u.level, u.xp, u.streak, u.avatar_color,
              COUNT(DISTINCT uq.id) FILTER (WHERE uq.status='completed') AS quests_completed
       FROM users u LEFT JOIN user_quests uq ON uq.user_id=u.id
       WHERE u.role != 'admin'
       GROUP BY u.id ORDER BY u.xp DESC LIMIT 3`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('top3:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const { period = 'all', search, limit = 50, offset = 0 } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    // XP за период — считаем через checkins, а не total xp
    let xpExpr = 'u.xp';
    let joinExpr = '';
    if (period === 'week' || period === 'month') {
      const interval = period === 'week' ? '7 days' : '30 days';
      // Суммируем xp_reward/duration_days за каждый checkin в периоде
      joinExpr = `
        LEFT JOIN (
          SELECT uq2.user_id,
                 SUM(q2.xp_reward / NULLIF(q2.duration_days, 0)) AS period_xp
          FROM quest_checkins qc2
          JOIN user_quests uq2 ON uq2.id = qc2.user_quest_id
          JOIN quests q2 ON q2.id = uq2.quest_id
          WHERE qc2.checked_at >= CURRENT_DATE - INTERVAL '${interval}'
          GROUP BY uq2.user_id
        ) px ON px.user_id = u.id
      `;
      xpExpr = 'COALESCE(px.period_xp, 0)';
    }

    const vals = [];
    let i = 1;
    let searchCond = '';
    if (search) { searchCond = `AND u.username ILIKE $${i++}`; vals.push(`%${search}%`); }

    vals.push(lim, off);

    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY ${xpExpr} DESC) AS rank,
         u.id AS user_id, u.username, u.level, u.xp,
         ${xpExpr} AS period_xp,
         u.streak, u.avatar_color,
         COUNT(DISTINCT uq.id) FILTER (WHERE uq.status='completed') AS quests_completed
       FROM users u
       ${joinExpr}
       LEFT JOIN user_quests uq ON uq.user_id=u.id
       WHERE u.role != 'admin' ${searchCond}
       GROUP BY u.id${period !== 'all' ? ', px.period_xp' : ''}
       ORDER BY ${xpExpr} DESC
       LIMIT $${i++} OFFSET $${i++}`, vals
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('leaderboard:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
