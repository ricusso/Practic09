function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Необходима авторизация' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    next();
  };
}
module.exports = checkRole;
