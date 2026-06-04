const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { getDb } = require('./lib/db');

const users = new Map();
const resetTokens = new Map();
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
  if (db) {
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
  } else {
    if (users.has(normalizedUsername)) {
      throw new AuthError(409, 'Benutzername ist bereits vergeben.');
    }
    users.set(normalizedUsername, {
      username: normalizedUsername,
      email: normalizedEmail,
      birthDate: parsedBirthDate.toISOString(),
      passwordHash
    });
  }

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

  const db = getDb();
  if (db) {
    const user = await db.user.findUnique({ where: { username: normalizedUsername } });
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
        birthDate: user.birthdate.toISOString()
      }
    };
  }

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

async function forgotPassword({ username }) {
  assertRequiredString(username, 'Benutzername');

  const normalizedUsername = username.trim();

  const db = getDb();
  if (db) {
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

  const user = users.get(normalizedUsername);
  if (!user) {
    return { message: 'Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  resetTokens.set(token, {
    username: normalizedUsername,
    expiresAt,
    used: false
  });

  return { message: 'Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.' };
}

async function resetPassword({ token, newPassword, newPasswordConfirm }) {
  assertRequiredString(token, 'Token');
  assertRequiredString(newPassword, 'Passwort');
  assertRequiredString(newPasswordConfirm, 'Passwortbestätigung');

  if (newPassword !== newPasswordConfirm) {
    throw new AuthError(400, 'Passwort und Passwortbestätigung stimmen nicht überein.');
  }

  const db = getDb();
  if (db) {
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

  const storedToken = resetTokens.get(token);
  if (!storedToken || storedToken.used || Date.now() > storedToken.expiresAt.getTime()) {
    throw new AuthError(400, 'Ungültiger oder abgelaufener Reset-Token.');
  }

  const user = users.get(storedToken.username);
  if (!user) {
    resetTokens.delete(token);
    throw new AuthError(400, 'Ungültiger oder abgelaufener Reset-Token.');
  }

  storedToken.used = true;
  user.passwordHash = await bcrypt.hash(newPassword, 12);

  return { message: 'Passwort erfolgreich zurückgesetzt.' };
}

async function resetUsers() {
  users.clear();
  resetTokens.clear();
  const db = getDb();
  if (db) {
    try {
      await db.passwordResetToken.deleteMany();
      await db.gamePlayer.deleteMany();
      await db.game.deleteMany();
      await db.user.deleteMany();
    } catch {
      // ignore cleanup errors
    }
  }
}

async function getStoredUser(username) {
  const db = getDb();
  if (db) {
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
  return users.get(username);
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

function getResetTokenForUser(username) {
  const db = getDb();
  if (db) {
    return null;
  }
  for (const [token, data] of resetTokens) {
    if (data.username === username && !data.used && Date.now() <= data.expiresAt.getTime()) {
      return token;
    }
  }
  return null;
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
  getResetTokenForUser
};
