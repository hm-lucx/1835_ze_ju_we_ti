const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { resetUsers, getStoredUser } = require('../src/authService');

let app;

test.beforeEach(() => {
  resetUsers();
  app = createApp();
});

test('Registrierung funktioniert und speichert Passwort gehasht', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler1',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2000-01-01'
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.message, 'Registrierung erfolgreich.');
  assert.equal(response.body.user.username, 'spieler1');
  assert.ok(response.body.token);

  const storedUser = getStoredUser('spieler1');
  assert.ok(storedUser);
  assert.notEqual(storedUser.passwordHash, 'GeheimesPasswort123');
});

test('Registrierung lehnt Minderjährige ab', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'zuJung',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2015-01-01'
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.message, 'Registrierung erst ab 16 Jahren möglich.');
});

test('Anmeldung funktioniert mit Benutzername und Passwort', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler2',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '1995-05-05'
    })
    .expect(201);

  const response = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'spieler2',
      password: 'GeheimesPasswort123'
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.message, 'Anmeldung erfolgreich.');
  assert.equal(response.body.user.username, 'spieler2');
  assert.ok(response.body.token);
});

test('Anmeldung mit falschem Passwort liefert verständliche Fehlermeldung', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler3',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '1990-01-01'
    })
    .expect(201);

  const response = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'spieler3',
      password: 'falsch'
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Ungültiger Benutzername oder Passwort.');
});

test('Registrierung mit unterschiedlicher Passwort-Bestätigung wird abgewiesen', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler4',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'AnderesPasswort123',
      birthDate: '1990-01-01'
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Passwort und Passwortbestätigung stimmen nicht überein.');
});

test('Rate Limiting greift bei zu vielen Login-Versuchen', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler5',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '1992-03-03'
    })
    .expect(201);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const attemptResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'spieler5',
        password: 'falsch'
      });

    assert.equal(attemptResponse.status, 401);
  }

  const blockedResponse = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'spieler5',
      password: 'falsch'
    });

  assert.equal(blockedResponse.status, 429);
  assert.equal(blockedResponse.body.message, 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.');
});
