const router = require('express').Router();
const pool = require('../db/pool');

router.get('/platform', async (req, res) => {
  try {
    const statsRes = await pool.query('SELECT stat_key, stat_value FROM platform_stats');
    const stats = {};
    statsRes.rows.forEach(r => { stats[r.stat_key] = r.stat_value; });

    // checkins_today всегда считаем живьём
    const todayRes = await pool.query(
      'SELECT COUNT(*) AS cnt FROM quest_checkins WHERE checked_at=CURRENT_DATE'
    );
    stats.checkins_today = parseInt(todayRes.rows[0].cnt);

    // Актуальные счётчики из БД (не кэш, чтобы не расходиться)
    const [uc, qc, ec] = await Promise.all([
      pool.query("SELECT COUNT(*) AS cnt FROM users WHERE role!='admin'"),
      pool.query("SELECT COUNT(*) AS cnt FROM quests WHERE status='active'"),
      pool.query('SELECT COUNT(*) AS cnt FROM experts WHERE verified=true'),
    ]);
    stats.users_count   = parseInt(uc.rows[0].cnt);
    stats.quests_count  = parseInt(qc.rows[0].cnt);
    stats.experts_count = parseInt(ec.rows[0].cnt);

    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('platform stats:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
