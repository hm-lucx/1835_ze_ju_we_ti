const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const users = new Map();
const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

class AuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

function getJwtSecret() {
  return process.env.JWT_SECRET || fallbackJwtSecret;
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

function resetUsers() {
  users.clear();
}

function getStoredUser(username) {
  return users.get(username);
}

module.exports = {
  AuthError,
  register,
  login,
  resetUsers,
  getStoredUser,
  isAtLeast16
};
