const express = require('express');
const rateLimit = require('express-rate-limit');
const { AuthError, register, login, forgotPassword, resetPassword, requireAuth } = require('./authService');
const { GameError, createGame, getGame, joinGame } = require('./gameService');

function createApp(options = {}) {
  const app = express();
  const registerRateLimiter = options.disableRateLimiting
    ? (req, res, next) => next()
    : rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.' }
  });

  const loginRateLimiter = options.disableRateLimiting
    ? (req, res, next) => next()
    : rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.' }
  });

  const forgotPasswordRateLimiter = options.disableRateLimiting
    ? (req, res, next) => next()
    : rateLimit({
    windowMs: 60 * 1000,
    max: 3,
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

  app.post('/api/auth/forgot-password', forgotPasswordRateLimiter, async (req, res, next) => {
    try {
      const result = await forgotPassword(req.body || {});
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/health', async (req, res) => {
    try {
      const prisma = require('./lib/prisma');
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.json({ status: 'ok', database: 'disconnected' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res, next) => {
    try {
      const result = await resetPassword(req.body || {});
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/games', requireAuth, async (req, res, next) => {
    try {
      const result = await createGame({ hostUsername: req.user.username });
      res.status(201).json({
        message: 'Spielrunde erstellt.',
        game: result
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/games/:id', requireAuth, async (req, res, next) => {
    try {
      const result = getGame(req.params.id, req.user.username);
      res.status(200).json({ game: result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/games/:id/join', requireAuth, async (req, res, next) => {
    try {
      const result = joinGame({
        gameId: req.params.id,
        inviteToken: req.body.inviteToken,
        username: req.user.username
      });
      res.status(200).json({
        message: 'Du bist der Runde beigetreten.',
        game: result
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    if (error instanceof AuthError || error instanceof GameError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Interner Serverfehler.' });
  });

  return app;
}

module.exports = {
  createApp
};
