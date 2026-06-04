const express = require('express');
const rateLimit = require('express-rate-limit');
const { AuthError, register, login } = require('./authService');

function createApp() {
  const app = express();
  const registerRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.' }
  });

  const loginRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.' }
  });

  app.use(express.json());

  app.post('/api/auth/register', registerRateLimiter, async (req, res, next) => {
    try {
      const result = await register(req.body || {});
      res.status(201).json({
        message: 'Registrierung erfolgreich.',
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', loginRateLimiter, async (req, res, next) => {
    try {
      const result = await login(req.body || {});
      res.status(200).json({
        message: 'Anmeldung erfolgreich.',
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Interner Serverfehler.' });
  });

  return app;
}

module.exports = {
  createApp
};
