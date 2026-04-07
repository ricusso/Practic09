require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

// ── Middleware ──
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// ── Статика — раздаём HTML-файлы из папки выше (../АКТИВ/) ──
app.use(express.static(path.join(__dirname, "..")));

// ── API роуты ──
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/quests", require("./routes/quests"));
app.use("/api/experts", require("./routes/experts"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/leaderboard", require("./routes/leaderboard"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/support", require("./routes/support"));

// ── 404 для неизвестных API роутов ──
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: "Эндпоинт не найден" });
});

// ── SPA fallback — всё остальное → index.html ──
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// ── Глобальный обработчик ошибок ──
app.use((err, req, res, next) => {
  console.error("Необработанная ошибка:", err.message);
  res.status(500).json({ success: false, error: "Внутренняя ошибка сервера" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ АКТИВ Backend запущен: http://localhost:${PORT}`);
  console.log(`✓ Фронтенд доступен на том же адресе`);
});
