const crypto = require('crypto');

const sessions = new Map();
const passwordResetTokens = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

const createSession = (user) => {
  const token = crypto.randomUUID();
  sessions.set(token, {
    id: user._id.toString(),
    name: user.name,
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'teacher',
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
};

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = session;
  next();
};

const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ error: `${role[0].toUpperCase() + role.slice(1)} access required` });
  next();
};

const requireParentAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  let session = token ? sessions.get(token) : null;
  if (session?.expiresAt <= Date.now()) {
    sessions.delete(token);
    session = null;
  }

  if (!session) return res.status(401).json({ error: 'Parent authentication required. Please log in with phone number.' });
  req.user = session;
  next();
};

const calculateGrade = (score, maxScore) => {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B+';
  if (percent >= 60) return 'B';
  if (percent >= 50) return 'C+';
  if (percent >= 35) return 'C';
  return 'D';
};

module.exports = {
  sessions,
  passwordResetTokens,
  createSession,
  requireAuth,
  requireRole,
  requireParentAuth,
  calculateGrade
};
