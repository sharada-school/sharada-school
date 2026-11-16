const crypto = require('crypto');
const { User } = require('../db');
const { hashPassword, verifyPassword } = require('../utils/passwords');
const { createSession, passwordResetTokens } = require('../middleware/auth');
const { createOtpChallenge, consumeOtp, OTP_TTL_MS } = require('../config/mailer');

const login = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase().replace(/^["']|["']$/g, '');
  const password = String(req.body.password || '').trim().replace(/^["']|["']$/g, '');

  let user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordCheck = await verifyPassword(password, user.password);
  if (!passwordCheck.valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (passwordCheck.needsRehash) {
    await User.updateOne({ id: user.id }, { password });
  }

  const role = user.role || 'teacher';
  res.json({
    id: (user.id || user._id).toString(),
    name: user.name,
    email: user.email,
    role,
    token: createSession({ ...user, role })
  });
};

const registerRequest = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (await User.exists({ email })) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await createOtpChallenge(email, 'registration', { name, passwordHash });
    res.json({ message: result?.warning || 'Verification code sent to your email.' });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
};

const registerVerify = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    const payload = await consumeOtp(email, 'registration', req.body.otp);
    const user = await User.create({ name: payload.name, email, passwordHash: payload.passwordHash, role: 'teacher' });
    res.status(201).json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: 'teacher',
      token: createSession(user)
    });
  } catch (error) {
    res.status(400).json({ error: error.code === 11000 ? 'An account with this email already exists.' : error.message });
  }
};

const passwordResetRequest = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    if (await User.exists({ email })) {
      const result = await createOtpChallenge(email, 'password-reset');
      res.json({ message: result?.warning || 'If an account exists, a verification code was sent to its email.' });
    } else {
      res.json({ message: 'If an account exists, a verification code was sent to its email.' });
    }
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
};

const passwordResetVerify = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    if (!(await User.exists({ email }))) {
      throw new Error('The OTP is invalid or expired.');
    }
    await consumeOtp(email, 'password-reset', req.body.otp);
    const resetToken = crypto.randomUUID();
    passwordResetTokens.set(resetToken, { email, expiresAt: Date.now() + OTP_TTL_MS });
    res.json({ resetToken });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const passwordResetComplete = async (req, res) => {
  const reset = passwordResetTokens.get(req.body.resetToken);
  const password = String(req.body.password || '');
  if (!reset || reset.expiresAt <= Date.now()) {
    return res.status(400).json({ error: 'The reset session is invalid or expired.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  await User.updateOne({ email: reset.email }, { password });
  passwordResetTokens.delete(req.body.resetToken);
  res.json({ message: 'Password updated successfully.' });
};

module.exports = {
  login,
  registerRequest,
  registerVerify,
  passwordResetRequest,
  passwordResetVerify,
  passwordResetComplete
};
