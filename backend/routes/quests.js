const router = require('express').Router();
const pool = require('../db/pool');
const requireAuth = require('../middleware/auth');

// GET /api/quests/my — ВАЖНО: до /:id
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user.userId;

    if (status === 'available') {
      const result = await pool.query(
        `SELECT q.*, u.username AS creator_username,
                COUNT(DISTINCT uq2.id) AS participants
         FROM quests q
         LEFT JOIN users u ON u.id=q.creator_id
         LEFT JOIN user_quests uq2 ON uq2.quest_id=q.id
         WHERE q.status='active'
           AND q.id NOT IN (SELECT quest_id FROM user_quests WHERE user_id=$1)
         GROUP BY q.id, u.username
         ORDER BY q.created_at DESC LIMIT 20`, [userId]
      );
      return res.json({ success: true, data: result.rows });
    }

    let statusCond = '';
    if (status === 'active')  statusCond = "AND uq.status='active'";
    if (status === 'archive') statusCond = "AND uq.status IN ('completed','failed')";

    const result = await pool.query(
      `SELECT uq.id AS user_quest_id, uq.status AS user_status,
              uq.progress, uq.started_at, uq.completed_at,
              q.*, u.username AS creator_username
       FROM user_quests uq
       JOIN quests q ON q.id=uq.quest_id
       LEFT JOIN users u ON u.id=q.creator_id
       WHERE uq.user_id=$1 ${statusCond}
       ORDER BY uq.started_at DESC`, [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('/my:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/quests
router.get('/', async (req, res) => {
  try {
    const { type, category, search, sort, limit = 20, offset = 0 } = req.query;
    const lim = Math.min(parseInt(limit) || 20, 100);
    const off = parseInt(offset) || 0;
    const conds = ["q.status='active'"];
    const vals = [];
    let i = 1;
    if (type)     { conds.push(`q.type=$${i++}`);          vals.push(type); }
    if (category) { conds.push(`q.category=$${i++}`);      vals.push(category); }
    if (search)   { conds.push(`q.title ILIKE $${i++}`);   vals.push(`%${search}%`); }

    const sortMap = { new:'q.created_at DESC', popular:'participants DESC', xp:'q.xp_reward DESC', price_asc:'q.price ASC', price_desc:'q.price DESC' };
    const order = sortMap[sort] || 'q.created_at DESC';

    // total для пагинации
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM quests q WHERE ${conds.join(' AND ')}`, vals
    );
    const total = parseInt(countRes.rows[0].count);

    vals.push(lim, off);
    const result = await pool.query(
      `SELECT q.*, u.username AS creator_username,
              COUNT(DISTINCT uq.id) AS participants
       FROM quests q
       LEFT JOIN users u ON u.id=q.creator_id
       LEFT JOIN user_quests uq ON uq.quest_id=q.id
       WHERE ${conds.join(' AND ')}
       GROUP BY q.id, u.username
       ORDER BY ${order}
       LIMIT $${i++} OFFSET $${i++}`, vals
    );
    res.json({ success: true, data: result.rows, total, limit: lim, offset: off });
  } catch (err) {
    console.error('GET quests:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/quests
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, type, category, duration_days, xp_reward, price, difficulty } = req.body;
    if (!title || !category) return res.status(400).json({ success: false, error: 'Название и категория обязательны' });
    if (title.length > 255) return res.status(400).json({ success: false, error: 'Название слишком длинное' });

    const result = await pool.query(
      `INSERT INTO quests (title, description, type, category, duration_days, xp_reward, creator_id, price, difficulty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        title, description || null,
        ['personal','group'].includes(type) ? type : 'personal',
        category,
        parseInt(duration_days) || 21,
        parseInt(xp_reward) || 100,
        req.user.userId,
        parseFloat(price) || 0,
        ['easy','mid','hard'].includes(difficulty) ? difficulty : 'mid',
      ]
    );
    await pool.query("UPDATE platform_stats SET stat_value=stat_value+1, updated_at=NOW() WHERE stat_key='quests_count'");
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST quest:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/quests/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const result = await pool.query(
      `SELECT q.*, u.username AS creator_username, u.avatar_color AS creator_avatar,
              COUNT(DISTINCT uq.id) AS participants,
              COALESCE(AVG(qr.rating),0)::DECIMAL(3,2) AS avg_rating,
              COUNT(DISTINCT qr.id) AS reviews_count
       FROM quests q
       LEFT JOIN users u ON u.id=q.creator_id
       LEFT JOIN user_quests uq ON uq.quest_id=q.id
       LEFT JOIN quest_reviews qr ON qr.quest_id=q.id
       WHERE q.id=$1
       GROUP BY q.id, u.username, u.avatar_color`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Квест не найден' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET quest:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// DELETE /api/quests/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const q = await pool.query('SELECT creator_id FROM quests WHERE id=$1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, error: 'Квест не найден' });
    if (q.rows[0].creator_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Нет прав на удаление' });
    }
    await pool.query('DELETE FROM quests WHERE id=$1', [id]);
    res.json({ success: true, data: { message: 'Квест удалён' } });
  } catch (err) {
    console.error('DELETE quest:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/quests/:id/join
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const questId = parseInt(req.params.id);
    const userId  = req.user.userId;
    if (isNaN(questId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });

    const qRes = await pool.query("SELECT id, title FROM quests WHERE id=$1 AND status='active'", [questId]);
    if (qRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Квест не найден или неактивен' });

    const ex = await pool.query('SELECT id FROM user_quests WHERE user_id=$1 AND quest_id=$2', [userId, questId]);
    if (ex.rows.length > 0) return res.status(409).json({ success: false, error: 'Вы уже участвуете в этом квесте' });

    const result = await pool.query(
      'INSERT INTO user_quests (user_id, quest_id) VALUES ($1,$2) RETURNING *', [userId, questId]
    );
    await pool.query(
      "INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'quest')",
      [userId, 'Квест начат!', `Вы вступили в квест "${qRes.rows[0].title}". Удачи!`]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('join:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/quests/:id/checkin
router.post('/:id/checkin', requireAuth, async (req, res) => {
  try {
    const questId = parseInt(req.params.id);
    const userId  = req.user.userId;
    if (isNaN(questId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const { note } = req.body;

    const uqRes = await pool.query(
      `SELECT uq.id, uq.progress, uq.status, q.xp_reward, q.duration_days, q.title
       FROM user_quests uq JOIN quests q ON q.id=uq.quest_id
       WHERE uq.user_id=$1 AND uq.quest_id=$2`, [userId, questId]
    );
    if (uqRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Вы не участвуете в этом квесте' });
    const uq = uqRes.rows[0];
    if (uq.status !== 'active') return res.status(400).json({ success: false, error: 'Квест не активен' });

    const todayCheck = await pool.query(
      'SELECT id FROM quest_checkins WHERE user_quest_id=$1 AND checked_at=CURRENT_DATE', [uq.id]
    );
    if (todayCheck.rows.length > 0) return res.status(409).json({ success: false, error: 'Вы уже отметились сегодня' });

    await pool.query('INSERT INTO quest_checkins (user_quest_id, note) VALUES ($1,$2)', [uq.id, note || null]);

    const cntRes = await pool.query('SELECT COUNT(*) AS cnt FROM quest_checkins WHERE user_quest_id=$1', [uq.id]);
    const totalCheckins = parseInt(cntRes.rows[0].cnt);
    const progress = Math.min(Math.round(totalCheckins / uq.duration_days * 100), 100);
    const xpPerDay = Math.max(1, Math.round(uq.xp_reward / uq.duration_days));

    // Стрик: была ли отметка вчера в любом квесте этого пользователя
    const userRes = await pool.query('SELECT streak FROM users WHERE id=$1', [userId]);
    const currStreak = parseInt(userRes.rows[0].streak);
    const yesterdayRes = await pool.query(
      `SELECT 1 FROM quest_checkins qc
       JOIN user_quests uq2 ON uq2.id=qc.user_quest_id
       WHERE uq2.user_id=$1 AND qc.checked_at=CURRENT_DATE-INTERVAL '1 day'
       LIMIT 1`, [userId]
    );
    const newStreak = yesterdayRes.rows.length > 0 ? currStreak + 1 : 1;

    // Обновляем пользователя: xp, streak, level (floor(xp/500)+1)
    await pool.query(
      `UPDATE users SET xp=xp+$1, streak=$2, level=FLOOR((xp+$1)/500)+1, updated_at=NOW() WHERE id=$3`,
      [xpPerDay, newStreak, userId]
    );

    let questStatus = 'active';
    if (progress >= 100) {
      questStatus = 'completed';
      await pool.query(
        "UPDATE user_quests SET progress=100, status='completed', completed_at=NOW() WHERE id=$1", [uq.id]
      );
      await pool.query(
        "INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'achievement')",
        [userId, 'Квест завершён! 🎉', `Вы прошли "${uq.title}"! +${uq.xp_reward} XP`]
      );
      await pool.query(
        "INSERT INTO achievements (user_id, type, title) VALUES ($1,'quest_done',$2)",
        [userId, `Завершён: ${uq.title}`]
      );
      // Ачивка за стрик
      if (newStreak === 7)  await pool.query("INSERT INTO achievements (user_id, type, title) VALUES ($1,'streak_7','Неделя без пропусков')", [userId]);
      if (newStreak === 21) await pool.query("INSERT INTO achievements (user_id, type, title) VALUES ($1,'streak_21','Три недели подряд')", [userId]);
      if (newStreak === 30) await pool.query("INSERT INTO achievements (user_id, type, title) VALUES ($1,'streak_30','Месяц без пропусков')", [userId]);
    } else {
      await pool.query('UPDATE user_quests SET progress=$1 WHERE id=$2', [progress, uq.id]);
    }

    res.json({ success: true, data: { xp_earned: xpPerDay, new_streak: newStreak, progress, quest_status: questStatus } });
  } catch (err) {
    console.error('checkin:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// GET /api/quests/:id/reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const result = await pool.query(
      `SELECT qr.*, u.username, u.avatar_color FROM quest_reviews qr
       JOIN users u ON u.id=qr.user_id WHERE qr.quest_id=$1 ORDER BY qr.created_at DESC`, [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('quest reviews:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// POST /api/quests/:id/reviews
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const questId = parseInt(req.params.id);
    const userId  = req.user.userId;
    if (isNaN(questId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
    const { rating, text } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, error: 'Оценка от 1 до 5' });
    const participated = await pool.query('SELECT id FROM user_quests WHERE user_id=$1 AND quest_id=$2', [userId, questId]);
    if (participated.rows.length === 0) return res.status(403).json({ success: false, error: 'Можно оставить отзыв только если вы участвовали' });
    const result = await pool.query(
      'INSERT INTO quest_reviews (quest_id, user_id, rating, text) VALUES ($1,$2,$3,$4) RETURNING *',
      [questId, userId, parseInt(rating), text || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Вы уже оставили отзыв' });
    console.error('post review:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

module.exports = router;
