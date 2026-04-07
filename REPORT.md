Приложение И
(обязательное)

Листинг программы

Листинг И.1 - Логика формирования глобального рейтинга (Leaderboard)
// Маршрут: GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const { type = 'xp', limit = 10 } = req.query;
    // Выбор поля для сортировки: по опыту (XP) или по серии дней (Streak)
    const sortField = type === 'streak' ? 'streak' : 'xp';
    
    const result = await pool.query(
      `SELECT id, username, level, xp, streak, avatar_color
       FROM users
       WHERE role != 'admin'
       ORDER BY ${sortField} DESC, level DESC
       LIMIT $1`, 
      [parseInt(limit) || 10]
    );

    // Добавление позиции (rank) каждому пользователю в ответе
    const rankedData = result.rows.map((user, index) => ({
      rank: index + 1,
      ...user
    }));

    res.json({ success: true, data: rankedData });
  } catch (err) {
    console.error('Ошибка получения лидерборда:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

Листинг И.2 - Получение детальной статистики пользователя и прогресса
// Маршрут: GET /api/users/:id/stats
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userRes = await pool.query('SELECT level, xp, streak FROM users WHERE id=$1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    const user = userRes.rows[0];

    // Подсчет завершенных и активных квестов пользователя
    const questsRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='completed') AS quests_completed,
         COUNT(*) FILTER (WHERE status='active')    AS quests_active
       FROM user_quests WHERE user_id=$1`, [id]
    );

    // Анализ активности по категориям квестов (процентное соотношение)
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
      by_category,
    }});
  } catch (err) {
    console.error('Ошибка статистики пользователя:', err.message);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

Листинг И.3 - Логика создания квеста и системы ежедневных отметок (Check-in)
// Маршрут создания квеста: POST /api/quests
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, type, category, duration_days, xp_reward, price, difficulty } = req.body;
    const result = await pool.query(
      `INSERT INTO quests (title, description, type, category, duration_days, xp_reward, creator_id, price, difficulty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, description, type || 'personal', category, duration_days || 21, xp_reward || 100, req.user.userId, price || 0, difficulty || 'mid']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Маршрут ежедневной отметки: POST /api/quests/:id/checkin
router.post('/:id/checkin', requireAuth, async (req, res) => {
  try {
    const questId = parseInt(req.params.id);
    const userId  = req.user.userId;

    // Регистрация отметки (check-in) в базе данных
    await pool.query('INSERT INTO quest_checkins (user_quest_id, note) VALUES ($1,$2)', [questId, req.body.note]);

    // Расчет нового прогресса (%) и динамическое начисление XP
    const uqRes = await pool.query('SELECT progress, duration_days, xp_reward FROM user_quests uq JOIN quests q ON q.id=uq.quest_id WHERE uq.id=$1', [questId]);
    const uq = uqRes.rows[0];
    const newProgress = Math.min(Math.round((uq.progress + (100 / uq.duration_days))), 100);
    const xpEarned = Math.round(uq.xp_reward / uq.duration_days);

    // Автоматический пересчет уровня пользователя при достижении порога XP (каждые 500 XP)
    await pool.query('UPDATE users SET xp=xp+$1, level=FLOOR((xp+$1)/500)+1 WHERE id=$2', [xpEarned, userId]);
    await pool.query('UPDATE user_quests SET progress=$1, status=$2 WHERE id=$3', [newProgress, newProgress >= 100 ? 'completed' : 'active', questId]);

    res.json({ success: true, data: { xp_earned: xpEarned, progress: newProgress } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка отметки' });
  }
});
