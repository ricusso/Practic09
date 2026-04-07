const jwt = require('jsonwebtoken');
const SECRET  = process.env.JWT_SECRET  || 'dev_secret_change_me';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
function signToken(payload) { return jwt.sign(payload, SECRET, { expiresIn: EXPIRES }); }
function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}
module.exports = { signToken, verifyToken };
