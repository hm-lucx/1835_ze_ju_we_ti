const express = require('express');
const rateLimit = require('express-rate-limit');
const { AuthError, register, login, requestPasswordReset, resetPassword } = require('./authService');

function createApp(options = {}) {
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

  app.post('/api/auth/forgot-password', async (req, res, next) => {
    try {
      const resetBaseUrl = `${req.protocol}://${req.get('host')}/reset-password`;
      const result = await requestPasswordReset(req.body || {}, {
        sendPasswordResetEmail: options.sendPasswordResetEmail,
        resetBaseUrl,
        now: typeof options.nowProvider === 'function' ? options.nowProvider() : undefined
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/reset-password', (req, res) => {
    const tokenValue = typeof req.query.token === 'string' && /^[a-f0-9]+$/i.test(req.query.token) ? req.query.token : '';
    res
      .status(200)
      .type('html')
      .send(`<!doctype html><html><body><h1>Passwort zurücksetzen</h1><form method="post" action="/api/auth/reset-password"><input type="hidden" name="token" value="${tokenValue}"><input type="password" name="password" placeholder="Neues Passwort"><input type="password" name="passwordConfirm" placeholder="Passwort wiederholen"><button type="submit">Passwort setzen</button></form></body></html>`);
  });

  app.post('/api/auth/reset-password', async (req, res, next) => {
    try {
      await resetPassword(req.body || {}, {
        now: typeof options.nowProvider === 'function' ? options.nowProvider() : undefined
      });
      res.status(200).json({
        message: 'Passwort erfolgreich zurückgesetzt.',
        redirectTo: '/login'
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
