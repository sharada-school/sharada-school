const dns = require('node:dns');
const os = require('node:os');
const crypto = require('crypto');

// 1. Force Node.js DNS to prefer IPv4 first globally
dns.setDefaultResultOrder('ipv4first');

// 2. Prevent Nodemailer v10 from detecting IPv6 support on container/host interfaces.
// Nodemailer queries AAAA (IPv6) records whenever os.networkInterfaces() reports an IPv6 interface.
// On cloud containers (Render, Docker, etc.) without an outbound IPv6 gateway, this causes:
// "connect ENETUNREACH 2607:f8b0:... - Local (:::0)"
const origNetworkInterfaces = os.networkInterfaces;
if (origNetworkInterfaces) {
  os.networkInterfaces = function () {
    const ifaces = origNetworkInterfaces.apply(this, arguments);
    const ipv4Only = {};
    for (const [name, addrs] of Object.entries(ifaces || {})) {
      ipv4Only[name] = (addrs || []).filter(a => a.family === 'IPv4' || a.family === 4);
    }
    return ipv4Only;
  };
}

try {
  const nmShared = require('nodemailer/dist/cjs/shared/index.js');
  if (nmShared && nmShared.networkInterfaces) {
    for (const key of Object.keys(nmShared.networkInterfaces)) {
      nmShared.networkInterfaces[key] = (nmShared.networkInterfaces[key] || []).filter(
        a => a.family === 'IPv4' || a.family === 4
      );
    }
  }
} catch {
  // Ignored if nodemailer bundle structure differs
}

const nodemailer = require('nodemailer');
const { OtpChallenge } = require('../db');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const port = Number(process.env.SMTP_PORT || 587);
const isPort465 = port === 465;
const secure = process.env.SMTP_SECURE !== undefined
  ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
  : isPort465;

const mailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port,
  secure,
  family: 4,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  tls: {
    rejectUnauthorized: false
  }
});

const hashOtp = (email, purpose, code) =>
  crypto.createHash('sha256').update(`${email}:${purpose}:${code}:${process.env.OTP_SECRET || 'sharada-school-otp'}`).digest('hex');

const sendOtp = async (email, code, purpose) => {
  const subject = purpose === 'registration' ? 'Verify your Sharada School teacher account' : 'Reset your Sharada School password';
  const text = `Your Sharada School verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`;

  // 1. If RESEND_API_KEY is configured, send via HTTPS REST API (Port 443).
  // This completely bypasses Render Free Tier's block on SMTP ports (25/465/587).
  if (process.env.RESEND_API_KEY) {
    const fromAddress = process.env.SMTP_FROM || 'Sharada School <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject,
        text
      })
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`❌ [Resend] Failed to send email to ${email} (${res.status}):`, errBody);
      throw new Error(`Resend API HTTP error (${res.status}): ${errBody}`);
    }
    const data = await res.json().catch(() => ({}));
    console.log(`✉️ [Resend] Email sent successfully to ${email}. ID: ${data?.id || 'OK'}`);
    return;
  }

  // 2. Otherwise use SMTP mailTransport
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM, or provide RESEND_API_KEY.');
  }

  await mailTransport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text
  });
};

const createOtpChallenge = async (email, purpose, payload = {}) => {
  const code = String(crypto.randomInt(100000, 1000000));
  await OtpChallenge.deleteMany({ email, purpose });
  await OtpChallenge.create({
    email,
    purpose,
    codeHash: hashOtp(email, purpose, code),
    payload,
    expiresAt: new Date(Date.now() + OTP_TTL_MS)
  });

  // Always log OTP for administrative recovery, monitoring, and debugging
  console.log(`🔑 [OTP] Verification code generated for ${email} (${purpose}): ${code}`);

  try {
    await sendOtp(email, code, purpose);
    return { sent: true };
  } catch (error) {
    console.error(`❌ [OTP] Failed to send email to ${email}:`, error.message);

    // If ALLOW_CONSOLE_OTP is enabled, do not delete the challenge so the admin/user can use console OTP
    if (process.env.ALLOW_CONSOLE_OTP === 'true') {
      console.warn(`⚠️ [OTP] ALLOW_CONSOLE_OTP is enabled. Verification challenge remains active for ${email}.`);
      return { sent: false, warning: 'Email delivery failed, but console OTP fallback is active. Enter the code shown in server logs.' };
    }

    await OtpChallenge.deleteMany({ email, purpose });

    let friendlyMessage = error.message;
    if (error.code === 'ENETUNREACH' || error.message.includes('ENETUNREACH')) {
      friendlyMessage = 'Email server network unreachable (IPv6 route unavailable). Server has been updated to force IPv4.';
    } else if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      friendlyMessage = 'Email connection timed out. If running on Render Free Tier, note that outbound SMTP ports (465/587) are blocked by Render. Enable ALLOW_CONSOLE_OTP=true in environment settings.';
    }

    const err = new Error(friendlyMessage);
    err.originalError = error;
    throw err;
  }
};

const consumeOtp = async (email, purpose, code) => {
  const challenge = await OtpChallenge.findOne({ email, purpose });
  if (!challenge || challenge.expiresAt <= new Date()) throw new Error('The OTP is invalid or expired.');
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new Error('Too many invalid OTP attempts. Request a new code.');
  const valid = hashOtp(email, purpose, String(code || '')) === challenge.codeHash;
  if (!valid) {
    await OtpChallenge.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
    throw new Error('The OTP is invalid or expired.');
  }
  await OtpChallenge.deleteOne({ _id: challenge._id });
  return challenge.payload || {};
};

module.exports = {
  mailTransport,
  sendOtp,
  createOtpChallenge,
  consumeOtp,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS
};
