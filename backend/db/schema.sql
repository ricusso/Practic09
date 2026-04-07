-- ══════════════════════════════════════
--  АКТИВ PLATFORM — schema.sql
--  PostgreSQL 15
-- ══════════════════════════════════════

DROP TABLE IF EXISTS account_deletion_requests CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS expert_reviews CASCADE;
DROP TABLE IF EXISTS quest_reviews CASCADE;
DROP TABLE IF EXISTS quest_checkins CASCADE;
DROP TABLE IF EXISTS user_quests CASCADE;
DROP TABLE IF EXISTS experts CASCADE;
DROP TABLE IF EXISTS quests CASCADE;
DROP TABLE IF EXISTS platform_stats CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS quest_type CASCADE;
DROP TYPE IF EXISTS quest_difficulty CASCADE;
DROP TYPE IF EXISTS quest_status_enum CASCADE;
DROP TYPE IF EXISTS user_quest_status CASCADE;
DROP TYPE IF EXISTS ticket_status CASCADE;

CREATE TYPE user_role         AS ENUM ('user', 'expert', 'admin');
CREATE TYPE quest_type        AS ENUM ('personal', 'group');
CREATE TYPE quest_difficulty  AS ENUM ('easy', 'mid', 'hard');
CREATE TYPE quest_status_enum AS ENUM ('active', 'draft', 'archived');
CREATE TYPE user_quest_status AS ENUM ('active', 'completed', 'failed');
CREATE TYPE ticket_status     AS ENUM ('open', 'closed');

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           user_role    NOT NULL DEFAULT 'user',
  level          INT          NOT NULL DEFAULT 1,
  xp             INT          NOT NULL DEFAULT 0,
  streak         INT          NOT NULL DEFAULT 0,
  avatar_color   VARCHAR(20)  NOT NULL DEFAULT '#e8a8d8',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_xp       ON users(xp DESC);

CREATE TABLE quests (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255)      NOT NULL,
  description   TEXT,
  type          quest_type        NOT NULL DEFAULT 'personal',
  category      VARCHAR(100)      NOT NULL,
  duration_days INT               NOT NULL DEFAULT 21,
  xp_reward     INT               NOT NULL DEFAULT 100,
  creator_id    INT               REFERENCES users(id) ON DELETE SET NULL,
  price         DECIMAL(10,2)     NOT NULL DEFAULT 0,
  difficulty    quest_difficulty  NOT NULL DEFAULT 'mid',
  status        quest_status_enum NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quests_category ON quests(category);
CREATE INDEX idx_quests_status   ON quests(status);

CREATE TABLE user_quests (
  id           SERIAL PRIMARY KEY,
  user_id      INT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id     INT              NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  status       user_quest_status NOT NULL DEFAULT 'active',
  progress     INT              NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, quest_id)
);
CREATE INDEX idx_user_quests_user  ON user_quests(user_id);
CREATE INDEX idx_user_quests_quest ON user_quests(quest_id);

CREATE TABLE quest_checkins (
  id            SERIAL PRIMARY KEY,
  user_quest_id INT  NOT NULL REFERENCES user_quests(id) ON DELETE CASCADE,
  checked_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  note          TEXT,
  UNIQUE(user_quest_id, checked_at)
);
CREATE INDEX idx_checkins_uq   ON quest_checkins(user_quest_id);
CREATE INDEX idx_checkins_date ON quest_checkins(checked_at);

CREATE TABLE experts (
  id                 SERIAL PRIMARY KEY,
  user_id            INT          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialty          VARCHAR(100) NOT NULL,
  bio                TEXT,
  methods            TEXT[]       DEFAULT '{}',
  price_consultation DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_monthly      DECIMAL(10,2) NOT NULL DEFAULT 0,
  verified           BOOLEAN      NOT NULL DEFAULT false,
  rating             DECIMAL(3,2) NOT NULL DEFAULT 0,
  reviews_count      INT          NOT NULL DEFAULT 0,
  students_count     INT          NOT NULL DEFAULT 0
);
CREATE INDEX idx_experts_specialty ON experts(specialty);
CREATE INDEX idx_experts_rating    ON experts(rating DESC);

CREATE TABLE expert_reviews (
  id         SERIAL PRIMARY KEY,
  expert_id  INT NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  rating     INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(expert_id, user_id)
);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  type       VARCHAR(50)  NOT NULL DEFAULT 'system',
  read       BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(user_id, read);

CREATE TABLE achievements (
  id        SERIAL PRIMARY KEY,
  user_id   INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type      VARCHAR(50)  NOT NULL,
  title     VARCHAR(255) NOT NULL,
  earned_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ach_user ON achievements(user_id);

CREATE TABLE support_tickets (
  id         SERIAL PRIMARY KEY,
  user_id    INT           REFERENCES users(id) ON DELETE SET NULL,
  subject    VARCHAR(255)  NOT NULL,
  message    TEXT          NOT NULL,
  status     ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE platform_stats (
  id         SERIAL PRIMARY KEY,
  stat_key   VARCHAR(100) NOT NULL UNIQUE,
  stat_value INT          NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE quest_reviews (
  id         SERIAL PRIMARY KEY,
  quest_id   INT NOT NULL REFERENCES quests(id)  ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  rating     INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(quest_id, user_id)
);

CREATE TABLE account_deletion_requests (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════
--  ТЕСТОВЫЕ ДАННЫЕ
--  Пароль для всех: password123
--  Хэш bcrypt salt=12, сгенерирован автоматически
-- ══════════════════════════════════════
INSERT INTO users (username, email, password_hash, role, level, xp, streak, avatar_color) VALUES
  ('Alex_Kostenko', 'alex@АКТИВ.ru',  '$2b$12$8dSQdoiXv8vT1WJkTUPfROGLgoBxYJ3bL/AZ7iCRZ5./3rxGqFudG', 'user',   12, 5500, 14, '#e8a8d8'),
  ('SofiPro',       'sofi@АКТИВ.ru',  '$2b$12$8dSQdoiXv8vT1WJkTUPfROGLgoBxYJ3bL/AZ7iCRZ5./3rxGqFudG', 'user',   8,  3800, 7,  '#b088d0'),
  ('DevRunner',     'dev@АКТИВ.ru',   '$2b$12$8dSQdoiXv8vT1WJkTUPfROGLgoBxYJ3bL/AZ7iCRZ5./3rxGqFudG', 'user',   15, 7200, 21, '#88c0d0'),
  ('Artem_Expert',  'artem@АКТИВ.ru', '$2b$12$8dSQdoiXv8vT1WJkTUPfROGLgoBxYJ3bL/AZ7iCRZ5./3rxGqFudG', 'expert', 20, 9800, 30, '#a3be8c'),
  ('AdminАКТИВ',     'admin@АКТИВ.ru', '$2b$12$8dSQdoiXv8vT1WJkTUPfROGLgoBxYJ3bL/AZ7iCRZ5./3rxGqFudG', 'admin',  25, 15000,60, '#ebcb8b');

INSERT INTO quests (title, description, type, category, duration_days, xp_reward, creator_id, price, difficulty) VALUES
  ('21 день кода',       'Каждый день пиши хотя бы 30 строк кода',      'personal', 'Разработка',   21, 500,  4, 0,    'easy'),
  ('Детокс от соцсетей', 'Никакого Instagram и TikTok на 14 дней',       'group',    'Психология',   14, 300,  4, 0,    'mid'),
  ('Утренний воин',      '5:00 AM подъём без компромиссов, 30 дней',     'personal', 'Режим дня',    30, 700,  4, 999,  'hard'),
  ('Читай каждый день',  '20 страниц книги в день на 21 день',           'personal', 'Саморазвитие', 21, 400,  1, 0,    'easy'),
  ('Марафон медитации',  '10 минут медитации каждое утро, 30 дней',      'group',    'Психология',   30, 600,  4, 1999, 'mid');

INSERT INTO user_quests (user_id, quest_id, status, progress) VALUES
  (1, 1, 'active',    42),
  (1, 2, 'completed', 100),
  (2, 1, 'active',    15),
  (2, 3, 'active',    60),
  (3, 1, 'completed', 100);

INSERT INTO experts (user_id, specialty, bio, methods, price_consultation, price_monthly, verified, rating, reviews_count, students_count) VALUES
  (4, 'Психология и продуктивность', 'Практикующий психолог, коуч ICF. Помогу наладить режим и убрать прокрастинацию.', ARRAY['КПТ','Майндфулнес','GTD'], 2500, 9900,  true, 4.9, 47, 213),
  (5, 'Программирование',            'Senior developer с 10 годами опыта. Помогу войти в IT или вырасти до сеньора.',   ARRAY['Code Review','Менторинг'],   3000, 12000, true, 4.7, 31, 89);

INSERT INTO expert_reviews (expert_id, user_id, rating, text) VALUES
  (1, 1, 5, 'Артём — гениальный наставник. Детокс работает, режим наладился за 2 недели.'),
  (1, 2, 5, 'Очень внимательный подход. Рекомендую!'),
  (2, 3, 4, 'Отличный ментор, помог с архитектурой проекта.');

INSERT INTO notifications (user_id, title, body, type, read) VALUES
  (1, 'Квест завершён! 🎉',   'Вы прошли "Детокс от соцсетей". +300 XP',               'achievement', false),
  (1, 'Новое достижение',     'Получена ачивка "Ранняя пташка"!',                       'achievement', false),
  (2, 'Стрик под угрозой!',   'Не забудьте сделать отметку сегодня.',                   'reminder',    true);

INSERT INTO achievements (user_id, type, title) VALUES
  (1, 'streak_7',   'Неделя без пропусков'),
  (1, 'quest_done', 'Первый завершённый квест'),
  (3, 'streak_21',  'Три недели подряд'),
  (3, 'quest_done', 'Марафонец');

INSERT INTO quest_reviews (quest_id, user_id, rating, text) VALUES
  (1, 2, 5, 'Отличный квест! Уже написал свой первый пет-проект.'),
  (2, 1, 4, 'Сложно первые 3 дня, потом втягиваешься.');

INSERT INTO platform_stats (stat_key, stat_value) VALUES
  ('users_count',   5),
  ('quests_count',  5),
  ('experts_count', 2);

INSERT INTO support_tickets (user_id, subject, message, status) VALUES
  (1, 'Не начисляется XP',  'Сделал отметку, но XP не добавился.',      'open'),
  (2, 'Вопрос по оплате',   'Как оформить возврат за экспертный квест?', 'closed');
