const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { getDb } = require('./lib/db');

const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
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
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  const dayDiff = now.getDate() - birthDate.getDate();
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

function createToken(username, birthDate) {
  const payload = { sub: username };
  if (birthDate) payload.birthDate = birthDate;
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

async function register({ username, email, password, passwordConfirm, birthDate }) {
  assertRequiredString(username, 'Benutzername');
  assertRequiredString(email, 'E-Mail');
  assertRequiredString(password, 'Passwort');
  assertRequiredString(passwordConfirm, 'Passwortbestätigung');
  assertRequiredString(birthDate, 'Geburtsdatum');

  const normalizedUsername = username.trim();
  const normalizedEmail = email.trim();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new AuthError(400, 'Ungültige E-Mail-Adresse.');
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AuthError(400, `Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`);
  }

  if (password !== passwordConfirm) {
    throw new AuthError(400, 'Passwort und Passwortbestätigung stimmen nicht überein.');
  }

  const parsedBirthDate = parseBirthDate(birthDate);
  if (!isAtLeast16(parsedBirthDate)) {
    throw new AuthError(400, 'Registrierung erst ab 16 Jahren möglich.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const db = getDb();

  const existing = await db.user.findUnique({ where: { username: normalizedUsername } });
  if (existing) {
    throw new AuthError(409, 'Benutzername ist bereits vergeben.');
  }
  const existingEmail = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existingEmail) {
    throw new AuthError(409, 'E-Mail-Adresse ist bereits vergeben.');
  }

  await db.user.create({
    data: {
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      birthdate: parsedBirthDate
    }
  });

  const birthDateStr = parsedBirthDate.toISOString();
  return {
    token: createToken(normalizedUsername, birthDateStr),
    user: {
      username: normalizedUsername,
      birthDate: birthDateStr
    }
  };
}

async function login({ username, password }) {
  assertRequiredString(username, 'Benutzername');
  assertRequiredString(password, 'Passwort');

  const normalizedUsername = username.trim();
  const db = getDb();

  const user = await db.user.findUnique({ where: { username: normalizedUsername } });
  if (!user) {
    throw new AuthError(401, 'Ungültiger Benutzername oder Passwort.');
  }
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthError(401, 'Ungültiger Benutzername oder Passwort.');
  }

  const birthDateStr = user.birthdate.toISOString();
  return {
    token: createToken(normalizedUsername, birthDateStr),
    user: {
      username: user.username,
      birthDate: birthDateStr
    }
  };
}

async function forgotPassword({ username }) {
  assertRequiredString(username, 'Benutzername');

  const normalizedUsername = username.trim();
  const db = getDb();

  const user = await db.user.findUnique({ where: { username: normalizedUsername } });
  if (!user) {
    return { message: 'Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt
    }
  });

  return { message: 'Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.' };
}

async function resetPassword({ token, newPassword, newPasswordConfirm }) {
  assertRequiredString(token, 'Token');
  assertRequiredString(newPassword, 'Passwort');
  assertRequiredString(newPasswordConfirm, 'Passwortbestätigung');

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new AuthError(400, `Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`);
  }

  if (newPassword !== newPasswordConfirm) {
    throw new AuthError(400, 'Passwort und Passwortbestätigung stimmen nicht überein.');
  }

  const db = getDb();

  const storedToken = await db.passwordResetToken.findUnique({ where: { token } });
  if (!storedToken || storedToken.usedAt || Date.now() > storedToken.expiresAt.getTime()) {
    throw new AuthError(400, 'Ungültiger oder abgelaufener Reset-Token.');
  }

  const user = await db.user.findUnique({ where: { id: storedToken.userId } });
  if (!user) {
    await db.passwordResetToken.delete({ where: { id: storedToken.id } });
    throw new AuthError(400, 'Ungültiger oder abgelaufener Reset-Token.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.$transaction([
    db.passwordResetToken.update({
      where: { id: storedToken.id },
      data: { usedAt: new Date() }
    }),
    db.user.update({
      where: { id: user.id },
      data: { passwordHash }
    })
  ]);

  return { message: 'Passwort erfolgreich zurückgesetzt.' };
}

async function resetUsers() {
  const db = getDb();
  try {
    await db.game.deleteMany();
    await db.user.deleteMany();
  } catch {
    // ignore cleanup errors
  }
}

async function getStoredUser(username) {
  const db = getDb();
  const user = await db.user.findUnique({ where: { username } });
  if (user) {
    return {
      username: user.username,
      birthDate: user.birthdate.toISOString(),
      passwordHash: user.passwordHash
    };
  }
  return undefined;
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret());
    return { username: payload.sub };
  } catch {
    throw new AuthError(401, 'Ungültiger oder abgelaufener Token.');
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AuthError(401, 'Authentifizierung erforderlich.'));
  }

  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      return next(error);
    }
    return next(new AuthError(401, 'Authentifizierung fehlgeschlagen.'));
  }
}

async function getResetTokenForUser(username) {
  const db = getDb();
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return null;
  const record = await db.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }
  });
  return record?.token || null;
}

async function createTestUser(username, email, password, birthDateStr) {
  const passwordHash = await bcrypt.hash(password, 12);
  const db = getDb();
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    throw new AuthError(409, 'Benutzername ist bereits vergeben.');
  }
  const parsed = parseBirthDate(birthDateStr);
  await db.user.create({
    data: { username, email, passwordHash, birthdate: parsed }
  });
  return createToken(username, parsed.toISOString());
}

module.exports = {
  AuthError,
  register,
  login,
  forgotPassword,
  resetPassword,
  resetUsers,
  getStoredUser,
  isAtLeast16,
  verifyToken,
  requireAuth,
  _getResetTokenForUser: getResetTokenForUser,
  createTestUser
};
