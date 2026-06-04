const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { resetUsers, getStoredUser, getResetTokenForUser } = require('../src/authService');

let app;

test.beforeEach(async () => {
  await resetUsers();
  app = createApp();
});

test('Registrierung funktioniert und speichert Passwort gehasht', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler1',
      email: 'spieler1@test.de',
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
      email: 'zujung@test.de',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2015-01-01'
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Registrierung erst ab 16 Jahren möglich.');
});

test('Anmeldung funktioniert mit Benutzername und Passwort', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler2',
      email: 'spieler2@test.de',
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
      email: 'spieler3@test.de',
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
      email: 'spieler4@test.de',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'AnderesPasswort123',
      birthDate: '1990-01-01'
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Passwort und Passwortbestätigung stimmen nicht überein.');
});

test('Passwort-Reset: Forgot-Password gibt immer gleiche Nachricht (ob Nutzer existiert oder nicht)', async () => {
  const noUserResponse = await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'nichtda' });

  assert.equal(noUserResponse.status, 200);
  assert.equal(noUserResponse.body.message, 'Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.');
});

test('Passwort-Reset: Forgot-Password erzeugt Token für existierenden Nutzer', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'resetUser',
      email: 'resetuser@test.de',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2000-01-01'
    })
    .expect(201);

  const response = await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'resetUser' });

  assert.equal(response.status, 200);
  assert.equal(response.body.message, 'Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.');
  assert.equal(response.body.token, undefined, 'Token darf nicht im Response stehen');
});

test('Passwort-Reset: Reset mit gültigem Token funktioniert', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'resetUser2',
      email: 'resetuser2@test.de',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2000-01-01'
    })
    .expect(201);

  await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'resetUser2' });

  const token = getResetTokenForUser('resetUser2');

  const resetResponse = await request(app)
    .post('/api/auth/reset-password')
    .send({
      token,
      newPassword: 'NeuesPasswort456',
      newPasswordConfirm: 'NeuesPasswort456'
    });

  assert.equal(resetResponse.status, 200);
  assert.equal(resetResponse.body.message, 'Passwort erfolgreich zurückgesetzt.');
});

test('Passwort-Reset: Kann sich nach Reset mit neuem Passwort anmelden', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'resetUser3',
      email: 'resetuser3@test.de',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2000-01-01'
    })
    .expect(201);

  await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'resetUser3' });

  const token = getResetTokenForUser('resetUser3');

  await request(app)
    .post('/api/auth/reset-password')
    .send({
      token,
      newPassword: 'NeuesPasswort456',
      newPasswordConfirm: 'NeuesPasswort456'
    })
    .expect(200);

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ username: 'resetUser3', password: 'NeuesPasswort456' });

  assert.equal(loginResponse.status, 200);
  assert.ok(loginResponse.body.token);
});

test('Passwort-Reset: Altes Passwort funktioniert nicht mehr nach Reset', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'resetUser4',
      email: 'resetuser4@test.de',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2000-01-01'
    })
    .expect(201);

  await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'resetUser4' });

  const token = getResetTokenForUser('resetUser4');

  await request(app)
    .post('/api/auth/reset-password')
    .send({
      token,
      newPassword: 'NeuesPasswort456',
      newPasswordConfirm: 'NeuesPasswort456'
    })
    .expect(200);

  const oldLoginResponse = await request(app)
    .post('/api/auth/login')
    .send({ username: 'resetUser4', password: 'GeheimesPasswort123' });

  assert.equal(oldLoginResponse.status, 401);
});

test('Passwort-Reset: Token ist nur einmal verwendbar', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'resetUser5',
      email: 'resetuser5@test.de',
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2000-01-01'
    })
    .expect(201);

  await request(app)
    .post('/api/auth/forgot-password')
    .send({ username: 'resetUser5' });

  const token = getResetTokenForUser('resetUser5');

  await request(app)
    .post('/api/auth/reset-password')
    .send({
      token,
      newPassword: 'NeuesPasswort456',
      newPasswordConfirm: 'NeuesPasswort456'
    })
    .expect(200);

  const secondResetResponse = await request(app)
    .post('/api/auth/reset-password')
    .send({
      token,
      newPassword: 'Passwort789',
      newPasswordConfirm: 'Passwort789'
    });

  assert.equal(secondResetResponse.status, 400);
  assert.equal(secondResetResponse.body.message, 'Ungültiger oder abgelaufener Reset-Token.');
});

test('Passwort-Reset: Ungültiger Token wird abgewiesen', async () => {
  const response = await request(app)
    .post('/api/auth/reset-password')
    .send({
      token: 'ungueltiger-token',
      newPassword: 'NeuesPasswort456',
      newPasswordConfirm: 'NeuesPasswort456'
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Ungültiger oder abgelaufener Reset-Token.');
});

test('Passwort-Reset: Fehlende Felder werden abgewiesen', async () => {
  const response = await request(app)
    .post('/api/auth/reset-password')
    .send({ token: 'irgendwas', newPassword: 'Passwort' });

  assert.equal(response.status, 400);
});

test('Rate Limiting greift bei zu vielen Login-Versuchen', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      username: 'spieler5',
      email: 'spieler5@test.de',
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
