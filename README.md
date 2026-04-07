# АКТИВ Platform

Геймифицированная платформа саморазвития. Фронтенд (19 HTML-страниц) + бэкенд (Node.js + PostgreSQL) в одном репозитории.

---

## Быстрый старт

### 1. Установить зависимости

```bash
cd backend
npm install
```

### 2. Создать базу данных

```bash
createdb АКТИВ_db
```

### 3. Применить схему + тестовые данные

```bash
psql -U postgres -d АКТИВ_db -f backend/db/schema.sql
```

### 4. Настроить окружение

```bash
cp backend/.env.example backend/.env
# Открой backend/.env и замени:
#   DB_PASSWORD=your_password_here
#   JWT_SECRET=любая_случайная_строка_32_символа
```

### 5. Запустить

```bash
cd backend
npm start
```

Открой браузер: **http://localhost:3001**

Для разработки с автоперезагрузкой: `npm run dev`

---

## Тестовые аккаунты

| Никнейм       | Email          | Пароль      | Роль   |
| ------------- | -------------- | ----------- | ------ |
| Alex_Kostenko | alex@АКТИВ.ru  | password123 | user   |
| SofiPro       | sofi@АКТИВ.ru  | password123 | user   |
| DevRunner     | dev@АКТИВ.ru   | password123 | user   |
| Artem_Expert  | artem@АКТИВ.ru | password123 | expert |
| AdminАКТИВ    | admin@АКТИВ.ru | password123 | admin  |

---

## Структура проекта

```
АКТИВ/
├── *.html              — 19 страниц фронтенда
├── admin.css           — общая дизайн-система (сайдбар, компоненты)
└── backend/
    ├── server.js       — Express сервер
    ├── package.json
    ├── .env.example
    ├── db/
    │   ├── pool.js     — подключение к PostgreSQL
    │   └── schema.sql  — 12 таблиц + индексы + данные
    ├── middleware/
    │   ├── auth.js     — JWT из httpOnly cookie
    │   └── role.js     — checkRole('admin')
    ├── routes/
    │   ├── auth.js         — /api/auth/*
    │   ├── users.js        — /api/users/*
    │   ├── quests.js       — /api/quests/*
    │   ├── experts.js      — /api/experts/*
    │   ├── notifications.js — /api/notifications/*
    │   ├── leaderboard.js  — /api/leaderboard/*
    │   ├── stats.js        — /api/stats/*
    │   └── support.js      — /api/support/*
    └── utils/
        └── jwt.js
```

---

## API — краткий справочник

Все ответы: `{ success: true, data: {...} }` или `{ success: false, error: '...' }`

| Метод  | Путь                            | Авторизация |
| ------ | ------------------------------- | ----------- |
| POST   | /api/auth/register              | —           |
| POST   | /api/auth/login                 | —           |
| POST   | /api/auth/logout                | —           |
| GET    | /api/auth/me                    | ✓           |
| GET    | /api/users/:id                  | —           |
| PUT    | /api/users/:id                  | ✓           |
| PUT    | /api/users/:id/password         | ✓           |
| DELETE | /api/users/:id                  | ✓           |
| GET    | /api/users/:id/stats            | ✓           |
| GET    | /api/quests                     | —           |
| POST   | /api/quests                     | ✓           |
| GET    | /api/quests/my                  | ✓           |
| GET    | /api/quests/:id                 | —           |
| DELETE | /api/quests/:id                 | ✓           |
| POST   | /api/quests/:id/join            | ✓           |
| POST   | /api/quests/:id/checkin         | ✓           |
| GET    | /api/quests/:id/reviews         | —           |
| POST   | /api/quests/:id/reviews         | ✓           |
| GET    | /api/experts                    | —           |
| GET    | /api/experts/:id                | —           |
| PUT    | /api/experts/:id                | ✓           |
| POST   | /api/experts/:id/book           | ✓           |
| GET    | /api/experts/:id/reviews        | —           |
| POST   | /api/experts/:id/reviews        | ✓           |
| GET    | /api/leaderboard                | —           |
| GET    | /api/leaderboard/top3           | —           |
| GET    | /api/notifications              | ✓           |
| GET    | /api/notifications/unread-count | ✓           |
| PUT    | /api/notifications/read-all     | ✓           |
| PUT    | /api/notifications/:id/read     | ✓           |
| GET    | /api/stats/platform             | —           |
| POST   | /api/support/tickets            | ✓           |

---

## Требования

- Node.js 18+
- PostgreSQL 14+
