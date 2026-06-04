const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

const users = new Map();
const passwordResetTokens = new Map();
const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

class AuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET muss in Produktion gesetzt sein.');
  }

  return fallbackJwtSecret;
}

function parseBirthDate(birthDate) {
  if (typeof birthDate !== 'string') {
    throw new AuthError(400, 'Bitte gib ein gültiges Geburtsdatum an.');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) {
    throw new AuthError(400, 'Bitte gib ein gültiges Geburtsdatum an.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AuthError(400, 'Bitte gib ein gültiges Geburtsdatum an.');
  }

  return date;
}

function isAtLeast16(birthDate, now = new Date()) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = now.getUTCDate() - birthDate.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 16;
}

function assertRequiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AuthError(400, `${label} ist erforderlich.`);
  }
}

function createToken(username) {
  return jwt.sign({ sub: username }, getJwtSecret(), { expiresIn: '7d' });
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP Konfiguration ist unvollständig.');
  }

  return {
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
    from
  };
}

async function sendPasswordResetEmail({ username, resetLink }) {
  const smtp = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth
  });

  await transporter.sendMail({
    from: smtp.from,
    to: username,
    subject: 'Passwort zurücksetzen',
    text: `Setze dein Passwort mit diesem Link zurück (gültig für 1 Stunde): ${resetLink}`
  });
}

async function register({ username, password, passwordConfirm, birthDate }) {
  assertRequiredString(username, 'Benutzername');
  assertRequiredString(password, 'Passwort');
  assertRequiredString(passwordConfirm, 'Passwortbestätigung');
  assertRequiredString(birthDate, 'Geburtsdatum');

  const normalizedUsername = username.trim();

  if (password !== passwordConfirm) {
    throw new AuthError(400, 'Passwort und Passwortbestätigung stimmen nicht überein.');
  }

  if (users.has(normalizedUsername)) {
    throw new AuthError(409, 'Benutzername ist bereits vergeben.');
  }

  const parsedBirthDate = parseBirthDate(birthDate);
  if (!isAtLeast16(parsedBirthDate)) {
    throw new AuthError(403, 'Registrierung erst ab 16 Jahren möglich.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  users.set(normalizedUsername, {
    username: normalizedUsername,
    birthDate: parsedBirthDate.toISOString(),
    passwordHash
  });

  return {
    token: createToken(normalizedUsername),
    user: {
      username: normalizedUsername,
      birthDate: parsedBirthDate.toISOString()
    }
  };
}

async function login({ username, password }) {
  assertRequiredString(username, 'Benutzername');
  assertRequiredString(password, 'Passwort');

  const normalizedUsername = username.trim();
  const user = users.get(normalizedUsername);

  if (!user) {
    throw new AuthError(401, 'Ungültiger Benutzername oder Passwort.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthError(401, 'Ungültiger Benutzername oder Passwort.');
  }

  return {
    token: createToken(normalizedUsername),
    user: {
      username: user.username,
      birthDate: user.birthDate
    }
  };
}

async function requestPasswordReset({ username }, options = {}) {
  assertRequiredString(username, 'Benutzername');

  const normalizedUsername = username.trim();
  const user = users.get(normalizedUsername);
  const genericResponse = {
    message: 'Wenn ein passender Account existiert, wurde eine E-Mail zum Zurücksetzen versendet.'
  };

  if (!user) {
    return genericResponse;
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);

  for (const [existingHash, tokenData] of passwordResetTokens.entries()) {
    if (tokenData.username === normalizedUsername) {
      passwordResetTokens.delete(existingHash);
    }
  }

  passwordResetTokens.set(tokenHash, {
    username: normalizedUsername,
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS).toISOString()
  });

  const sender = options.sendPasswordResetEmail || sendPasswordResetEmail;
  const resetBaseUrl = options.resetBaseUrl || 'http://localhost:3000/reset-password';
  const resetLink = `${resetBaseUrl}?token=${encodeURIComponent(rawToken)}`;
  await sender({
    username: normalizedUsername,
    resetLink
  });

  return genericResponse;
}

async function resetPassword({ token, password, passwordConfirm }, options = {}) {
  assertRequiredString(token, 'Reset-Token');
  assertRequiredString(password, 'Passwort');
  assertRequiredString(passwordConfirm, 'Passwortbestätigung');

  if (password !== passwordConfirm) {
    throw new AuthError(400, 'Passwort und Passwortbestätigung stimmen nicht überein.');
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const tokenHash = hashResetToken(token.trim());
  const tokenData = passwordResetTokens.get(tokenHash);

  if (!tokenData) {
    throw new AuthError(400, 'Reset-Link ist ungültig oder abgelaufen.');
  }

  if (new Date(tokenData.expiresAt).getTime() <= now.getTime()) {
    passwordResetTokens.delete(tokenHash);
    throw new AuthError(400, 'Reset-Link ist ungültig oder abgelaufen.');
  }

  const user = users.get(tokenData.username);
  if (!user) {
    passwordResetTokens.delete(tokenHash);
    throw new AuthError(400, 'Reset-Link ist ungültig oder abgelaufen.');
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  passwordResetTokens.delete(tokenHash);
}

function resetUsers() {
  users.clear();
  passwordResetTokens.clear();
}

function getStoredUser(username) {
  return users.get(username);
}

module.exports = {
  AuthError,
  register,
  login,
  requestPasswordReset,
  resetPassword,
  resetUsers,
  getStoredUser,
  isAtLeast16,
  sendPasswordResetEmail
};
