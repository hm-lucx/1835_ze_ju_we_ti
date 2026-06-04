const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { resetUsers } = require('../src/authService');
const { resetGames } = require('../src/gameService');

let app;

function asUser(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function registerAndGetToken(app, username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      username,
      email: `${username}@test.de`,
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: '2000-01-01'
    });
  return res.body.token;
}

test.beforeEach(async () => {
  await resetUsers();
  await resetGames();
  app = createApp({ disableRateLimiting: true });
});

test('Spiel erstellen ohne Auth wird abgewiesen', async () => {
  const response = await request(app)
    .post('/api/games');

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Authentifizierung erforderlich.');
});

test('Spiel erstellen mit gültigem Token funktioniert', async () => {
  const token = await registerAndGetToken(app, 'host1');

  const response = await request(app)
    .post('/api/games')
    .set(asUser(token));

  assert.equal(response.status, 201);
  assert.equal(response.body.message, 'Spielrunde erstellt.');
  assert.ok(response.body.game.id);
  assert.equal(response.body.game.host, 'host1');
  assert.equal(response.body.game.status, 'LOBBY');
  assert.equal(response.body.game.players.length, 1);
  assert.equal(response.body.game.players[0].username, 'host1');
  assert.ok(response.body.game.inviteLink);
  assert.ok(response.body.game.qrCodeSvg);
});

test('Spiel erstellen liefert QR-Code als SVG', async () => {
  const token = await registerAndGetToken(app, 'host2');

  const response = await request(app)
    .post('/api/games')
    .set(asUser(token));

  assert.equal(response.status, 201);
  assert.ok(response.body.game.qrCodeSvg.startsWith('<svg'));
});

test('Spiel einsehen als Teilnehmer', async () => {
  const token = await registerAndGetToken(app, 'host3');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(token));

  const gameId = createRes.body.game.id;

  const getRes = await request(app)
    .get(`/api/games/${gameId}`)
    .set(asUser(token));

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.game.id, gameId);
  assert.equal(getRes.body.game.host, 'host3');
});

test('Spiel einsehen ohne Auth wird abgewiesen', async () => {
  const response = await request(app)
    .get('/api/games/irgendeine-id');

  assert.equal(response.status, 401);
});

test('Spiel einsehen als Nicht-Teilnehmer wird abgewiesen', async () => {
  const token1 = await registerAndGetToken(app, 'host4');
  const token2 = await registerAndGetToken(app, 'viewer1');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(token1));

  const gameId = createRes.body.game.id;

  const getRes = await request(app)
    .get(`/api/games/${gameId}`)
    .set(asUser(token2));

  assert.equal(getRes.status, 403);
  assert.equal(getRes.body.message, 'Nur Teilnehmer können diese Runde einsehen.');
});

test('Spiel beitreten mit gültigem Token funktioniert', async () => {
  const hostToken = await registerAndGetToken(app, 'host5');
  const playerToken = await registerAndGetToken(app, 'player1');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));

  const game = createRes.body.game;

  const joinRes = await request(app)
    .post(`/api/games/${game.id}/join`)
    .set(asUser(playerToken))
    .send({ inviteToken: game.inviteLink.split('token=')[1].split('&')[0] });

  assert.equal(joinRes.status, 200);
  assert.equal(joinRes.body.message, 'Du bist der Runde beigetreten.');
  assert.equal(joinRes.body.game.players.length, 2);
});

test('Beitreten ohne Auth wird abgewiesen', async () => {
  const response = await request(app)
    .post('/api/games/irgendeine-id/join')
    .send({ inviteToken: 'irgendein-token' });

  assert.equal(response.status, 401);
});

test('Beitreten mit falschem Invite-Token wird abgewiesen', async () => {
  const hostToken = await registerAndGetToken(app, 'host6');
  const playerToken = await registerAndGetToken(app, 'player2');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));

  const gameId = createRes.body.game.id;

  const joinRes = await request(app)
    .post(`/api/games/${gameId}/join`)
    .set(asUser(playerToken))
    .send({ inviteToken: 'falscher-token' });

  assert.equal(joinRes.status, 403);
  assert.equal(joinRes.body.message, 'Ungültiger Einladungslink.');
});

test('Beitreten zu nicht-existierendem Spiel wird abgewiesen', async () => {
  const token = await registerAndGetToken(app, 'player3');

  const joinRes = await request(app)
    .post('/api/games/nicht-existierend/join')
    .set(asUser(token))
    .send({ inviteToken: 'irgendwas' });

  assert.equal(joinRes.status, 404);
});

test('Doppelter Beitritt wird abgewiesen', async () => {
  const hostToken = await registerAndGetToken(app, 'host7');
  const playerToken = await registerAndGetToken(app, 'player4');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));

  const game = createRes.body.game;
  const inviteToken = game.inviteLink.split('token=')[1].split('&')[0];

  await request(app)
    .post(`/api/games/${game.id}/join`)
    .set(asUser(playerToken))
    .send({ inviteToken });

  const secondJoinRes = await request(app)
    .post(`/api/games/${game.id}/join`)
    .set(asUser(playerToken))
    .send({ inviteToken });

  assert.equal(secondJoinRes.status, 409);
  assert.equal(secondJoinRes.body.message, 'Du bist bereits in dieser Runde.');
});

test('Spiel starten als Host funktioniert', async () => {
  const token = await registerAndGetToken(app, 'hostStart');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(token));

  const gameId = createRes.body.game.id;

  const startRes = await request(app)
    .post(`/api/games/${gameId}/start`)
    .set(asUser(token));

  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.message, 'Spiel gestartet.');
  assert.equal(startRes.body.game.status, 'RUNNING');
  assert.ok(startRes.body.game.startedAt);
});

test('Spiel starten ohne Auth wird abgewiesen', async () => {
  const response = await request(app)
    .post('/api/games/irgendeine-id/start');

  assert.equal(response.status, 401);
});

test('Spiel starten als Nicht-Host wird abgewiesen', async () => {
  const hostToken = await registerAndGetToken(app, 'hostStart2');
  const guestToken = await registerAndGetToken(app, 'guestStart');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));

  const gameId = createRes.body.game.id;

  const startRes = await request(app)
    .post(`/api/games/${gameId}/start`)
    .set(asUser(guestToken));

  assert.equal(startRes.status, 403);
  assert.equal(startRes.body.message, 'Nur der Host kann das Spiel starten.');
});

test('Spiel starten doppelt wird abgewiesen', async () => {
  const token = await registerAndGetToken(app, 'hostStart3');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(token));

  const gameId = createRes.body.game.id;

  await request(app)
    .post(`/api/games/${gameId}/start`)
    .set(asUser(token))
    .expect(200);

  const secondStartRes = await request(app)
    .post(`/api/games/${gameId}/start`)
    .set(asUser(token));

  assert.equal(secondStartRes.status, 400);
  assert.equal(secondStartRes.body.message, 'Spielrunde hat bereits begonnen.');
});

test('Maximale Spieleranzahl von 7 wird durchgesetzt', async () => {
  const hostToken = await registerAndGetToken(app, 'host8');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));

  const game = createRes.body.game;
  const inviteToken = game.inviteLink.split('token=')[1].split('&')[0];

  for (let i = 1; i <= 6; i++) {
    const playerToken = await registerAndGetToken(app, `player${i}_full`);
    await request(app)
      .post(`/api/games/${game.id}/join`)
      .set(asUser(playerToken))
      .send({ inviteToken })
      .expect(200);
  }

  const extraToken = await registerAndGetToken(app, 'extraPlayer');
  const extraJoinRes = await request(app)
    .post(`/api/games/${game.id}/join`)
    .set(asUser(extraToken))
    .send({ inviteToken });

  assert.equal(extraJoinRes.status, 400);
  assert.ok(extraJoinRes.body.message.includes('Maximale Spieleranzahl'));
});
