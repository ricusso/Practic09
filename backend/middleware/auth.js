const { verifyToken } = require('../utils/jwt');
function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: 'Необходима авторизация' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success: false, error: 'Токен недействителен или истёк' });
  req.user = payload;
  next();
}
module.exports = requireAuth;
