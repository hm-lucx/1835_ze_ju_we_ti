const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const users = new Map();
const resetTokens = new Map();
const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

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

async function forgotPassword({ username }) {
  assertRequiredString(username, 'Benutzername');

  const normalizedUsername = username.trim();
  const user = users.get(normalizedUsername);

  // Don't reveal whether the user exists
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

  return { message: 'Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.', token };
}

async function resetPassword({ token, newPassword, newPasswordConfirm }) {
  assertRequiredString(token, 'Token');
  assertRequiredString(newPassword, 'Passwort');
  assertRequiredString(newPasswordConfirm, 'Passwortbestätigung');

  if (newPassword !== newPasswordConfirm) {
    throw new AuthError(400, 'Passwort und Passwortbestätigung stimmen nicht überein.');
  }

  const storedToken = resetTokens.get(token);

  if (!storedToken) {
    throw new AuthError(400, 'Ungültiger oder abgelaufener Reset-Token.');
  }

  if (storedToken.used) {
    throw new AuthError(400, 'Ungültiger oder abgelaufener Reset-Token.');
  }

  if (Date.now() > storedToken.expiresAt.getTime()) {
    resetTokens.delete(token);
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

function resetUsers() {
  users.clear();
  resetTokens.clear();
}

function getStoredUser(username) {
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
    return res.status(401).json({ message: 'Authentifizierung erforderlich.' });
  }

  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(401).json({ message: 'Authentifizierung fehlgeschlagen.' });
  }
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
  requireAuth
};
