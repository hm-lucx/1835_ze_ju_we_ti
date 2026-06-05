const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { resetUsers, createTestUser } = require('../src/authService');
const { resetGames } = require('../src/gameService');

let app;

function asUser(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function registerAndGetToken(app, username, birthDate) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      username,
      email: `${username}@test.de`,
      password: 'GeheimesPasswort123',
      passwordConfirm: 'GeheimesPasswort123',
      birthDate: birthDate || '2000-01-01'
    });
  return res.body.token;
}

async function joinGame(app, token, gameId, inviteToken) {
  return request(app)
    .post(`/api/games/${gameId}/join`)
    .set({ Authorization: `Bearer ${token}` })
    .send({ inviteToken });
}

async function createAndGetInviteToken(app, token) {
  const createRes = await request(app)
    .post('/api/games')
    .set({ Authorization: `Bearer ${token}` });
  const game = createRes.body.game;
  const inviteToken = game.inviteLink.split('token=')[1].split('&')[0];
  return { game, inviteToken };
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

  const { game } = (await request(app)
    .post('/api/games')
    .set(asUser(token))).body;

  const getRes = await request(app)
    .get(`/api/games/${game.id}`)
    .set(asUser(token));

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.game.id, game.id);
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

  const { game } = (await request(app)
    .post('/api/games')
    .set(asUser(token1))).body;

  const getRes = await request(app)
    .get(`/api/games/${game.id}`)
    .set(asUser(token2));

  assert.equal(getRes.status, 403);
  assert.equal(getRes.body.message, 'Nur Teilnehmer können diese Runde einsehen.');
});

test('Spiel beitreten mit gültigem Token funktioniert', async () => {
  const hostToken = await registerAndGetToken(app, 'host5');
  const playerToken = await registerAndGetToken(app, 'player1');

  const { game } = (await request(app)
    .post('/api/games')
    .set(asUser(hostToken))).body;
  const inviteToken = game.inviteLink.split('token=')[1].split('&')[0];

  const joinRes = await request(app)
    .post(`/api/games/${game.id}/join`)
    .set(asUser(playerToken))
    .send({ inviteToken });

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

  const { game } = (await request(app)
    .post('/api/games')
    .set(asUser(hostToken))).body;

  const joinRes = await request(app)
    .post(`/api/games/${game.id}/join`)
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

  const { game, inviteToken } = await createAndGetInviteToken(app, hostToken);

  await joinGame(app, playerToken, game.id, inviteToken);

  const secondJoinRes = await joinGame(app, playerToken, game.id, inviteToken);

  assert.equal(secondJoinRes.status, 409);
  assert.equal(secondJoinRes.body.message, 'Du bist bereits in dieser Runde.');
});

test('Spiel starten als Host funktioniert', async () => {
  const token = await registerAndGetToken(app, 'hostStart');

  const { game, inviteToken } = await createAndGetInviteToken(app, token);

  const player2Token = await registerAndGetToken(app, 'p2_start');
  const player3Token = await registerAndGetToken(app, 'p3_start');

  await joinGame(app, player2Token, game.id, inviteToken);
  await joinGame(app, player3Token, game.id, inviteToken);

  const startRes = await request(app)
    .post(`/api/games/${game.id}/start`)
    .set(asUser(token));

  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.message, 'Spiel gestartet.');
  assert.equal(startRes.body.game.status, 'RUNNING');
  assert.ok(startRes.body.game.startedAt);
  assert.ok(startRes.body.game.accounts);
  assert.equal(startRes.body.game.accounts.length, 3);
});

test('Spiel starten ohne Auth wird abgewiesen', async () => {
  const response = await request(app)
    .post('/api/games/irgendeine-id/start');

  assert.equal(response.status, 401);
});

test('Spiel starten als Nicht-Host wird abgewiesen', async () => {
  const hostToken = await registerAndGetToken(app, 'hostStart2');
  const guestToken = await registerAndGetToken(app, 'guestStart');

  const { game, inviteToken } = await createAndGetInviteToken(app, hostToken);

  const p2 = await registerAndGetToken(app, 'p2_nh');
  const p3 = await registerAndGetToken(app, 'p3_nh');
  await joinGame(app, p2, game.id, inviteToken);
  await joinGame(app, p3, game.id, inviteToken);

  const startRes = await request(app)
    .post(`/api/games/${game.id}/start`)
    .set(asUser(guestToken));

  assert.equal(startRes.status, 403);
  assert.equal(startRes.body.message, 'Nur der Host kann das Spiel starten.');
});

test('Spiel starten doppelt wird abgewiesen', async () => {
  const token = await registerAndGetToken(app, 'hostStart3');

  const { game, inviteToken } = await createAndGetInviteToken(app, token);

  const p2 = await registerAndGetToken(app, 'p2_ds');
  const p3 = await registerAndGetToken(app, 'p3_ds');
  await joinGame(app, p2, game.id, inviteToken);
  await joinGame(app, p3, game.id, inviteToken);

  await request(app)
    .post(`/api/games/${game.id}/start`)
    .set(asUser(token))
    .expect(200);

  const secondStartRes = await request(app)
    .post(`/api/games/${game.id}/start`)
    .set(asUser(token));

  assert.equal(secondStartRes.status, 400);
  assert.equal(secondStartRes.body.message, 'Spielrunde hat bereits begonnen.');
});

test('Spiel starten mit weniger als 3 Spielern wird abgewiesen', async () => {
  const token = await registerAndGetToken(app, 'hostMin');

  const { game } = await createAndGetInviteToken(app, token);

  const startRes = await request(app)
    .post(`/api/games/${game.id}/start`)
    .set(asUser(token));

  assert.equal(startRes.status, 400);
  assert.equal(startRes.body.message, 'Mindestens 3 Spieler erforderlich, um zu starten.');
});

test('Spiel starten mit genau 3 Spielern ist erlaubt', async () => {
  const token = await registerAndGetToken(app, 'hostExact');

  const { game, inviteToken } = await createAndGetInviteToken(app, token);

  const p2 = await registerAndGetToken(app, 'p2_exact');
  const p3 = await registerAndGetToken(app, 'p3_exact');
  await joinGame(app, p2, game.id, inviteToken);
  await joinGame(app, p3, game.id, inviteToken);

  const startRes = await request(app)
    .post(`/api/games/${game.id}/start`)
    .set(asUser(token));

  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.game.status, 'RUNNING');
});

test('Beitreten nach Spielstart wird abgewiesen', async () => {
  const hostToken = await registerAndGetToken(app, 'hostAfter');
  const lateToken = await registerAndGetToken(app, 'latePlayer');

  const { game, inviteToken } = await createAndGetInviteToken(app, hostToken);

  const p2 = await registerAndGetToken(app, 'p2_after');
  const p3 = await registerAndGetToken(app, 'p3_after');
  await joinGame(app, p2, game.id, inviteToken);
  await joinGame(app, p3, game.id, inviteToken);

  await request(app)
    .post(`/api/games/${game.id}/start`)
    .set(asUser(hostToken))
    .expect(200);

  const lateJoinRes = await joinGame(app, lateToken, game.id, inviteToken);

  assert.equal(lateJoinRes.status, 400);
  assert.equal(lateJoinRes.body.message, 'Diese Runde hat bereits begonnen.');
});

test('Beitreten unter 16 Jahren wird abgewiesen', async () => {
  const hostToken = await registerAndGetToken(app, 'hostAge');

  const youngToken = await createTestUser('youngPlayer', 'young@test.de', 'GeheimesPasswort123', '2015-06-01');

  const { game, inviteToken } = await createAndGetInviteToken(app, hostToken);

  const joinRes = await joinGame(app, youngToken, game.id, inviteToken);

  assert.equal(joinRes.status, 403);
  assert.equal(joinRes.body.message, 'Mindestalter nicht erfüllt.');
});

test('Beitreten mit exakt 16 Jahren ist erlaubt', async () => {
  const today = new Date();
  const birthYear = today.getUTCFullYear() - 16;
  const birthDate = `${birthYear}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

  const hostToken = await registerAndGetToken(app, 'hostExact16');
  const ageToken = await registerAndGetToken(app, 'exact16', birthDate);

  const { game, inviteToken } = await createAndGetInviteToken(app, hostToken);

  const joinRes = await joinGame(app, ageToken, game.id, inviteToken);

  assert.equal(joinRes.status, 200);
});

test('Maximale Spieleranzahl von 7 wird durchgesetzt', async () => {
  const hostToken = await registerAndGetToken(app, 'host8');

  const { game, inviteToken } = await createAndGetInviteToken(app, hostToken);

  for (let i = 1; i <= 6; i++) {
    const playerToken = await registerAndGetToken(app, `player${i}_full`);
    await joinGame(app, playerToken, game.id, inviteToken);
  }

  const extraToken = await registerAndGetToken(app, 'extraPlayer');
  const extraJoinRes = await joinGame(app, extraToken, game.id, inviteToken);

  assert.equal(extraJoinRes.status, 409);
  assert.equal(extraJoinRes.body.message, 'Diese Runde ist bereits voll.');
});

test('Spiel erstellen liefert inviteCode', async () => {
  const token = await registerAndGetToken(app, 'hostCode');
  const res = await request(app)
    .post('/api/games')
    .set(asUser(token));

  assert.equal(res.status, 201);
  assert.ok(res.body.game.inviteCode);
  assert.equal(res.body.game.inviteCode.length, 6);
});

test('POST /api/rounds/join mit gültigem Code funktioniert', async () => {
  const hostToken = await registerAndGetToken(app, 'hostJoinCode');
  const playerToken = await registerAndGetToken(app, 'playerJoinCode');

  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));
  const { inviteCode } = createRes.body.game;

  const joinRes = await request(app)
    .post('/api/rounds/join')
    .set(asUser(playerToken))
    .send({ inviteCode });

  assert.equal(joinRes.status, 200);
  assert.ok(joinRes.body.roundId);
  assert.ok(joinRes.body.playerCount);
});

test('POST /api/rounds/join ohne Auth wird abgewiesen', async () => {
  const res = await request(app)
    .post('/api/rounds/join')
    .send({ inviteCode: 'ABC123' });

  assert.equal(res.status, 401);
});

test('POST /api/rounds/join mit ungültigem Code gibt 404', async () => {
  const token = await registerAndGetToken(app, 'playerBadCode');
  const res = await request(app)
    .post('/api/rounds/join')
    .set(asUser(token))
    .send({ inviteCode: 'XXXXXX' });

  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Code ungültig oder abgelaufen.');
});

test('POST /api/rounds/join bei voller Runde gibt 409', async () => {
  const hostToken = await registerAndGetToken(app, 'hostFullCode');
  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));
  const { inviteCode } = createRes.body.game;

  const playerTokens = [];
  for (let i = 1; i <= 6; i++) {
    const pt = await registerAndGetToken(app, `p_full_${i}`);
    playerTokens.push(pt);
    await request(app)
      .post('/api/rounds/join')
      .set(asUser(pt))
      .send({ inviteCode });
  }

  const extraToken = await registerAndGetToken(app, 'extraFull');
  const extraRes = await request(app)
    .post('/api/rounds/join')
    .set(asUser(extraToken))
    .send({ inviteCode });

  assert.equal(extraRes.status, 409);
  assert.equal(extraRes.body.message, 'Runde ist voll.');
});

test('POST /api/rounds/join bereits gestartete Runde gibt 409', async () => {
  const hostToken = await registerAndGetToken(app, 'hostStartedCode');
  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));
  const { inviteCode, id } = createRes.body.game;

  const p2 = await registerAndGetToken(app, 'p2_start_code');
  const p3 = await registerAndGetToken(app, 'p3_start_code');
  await request(app).post('/api/rounds/join').set(asUser(p2)).send({ inviteCode });
  await request(app).post('/api/rounds/join').set(asUser(p3)).send({ inviteCode });

  await request(app)
    .post(`/api/games/${id}/start`)
    .set(asUser(hostToken));

  const lateToken = await registerAndGetToken(app, 'late_start_code');
  const lateRes = await request(app)
    .post('/api/rounds/join')
    .set(asUser(lateToken))
    .send({ inviteCode });

  assert.equal(lateRes.status, 409);
  assert.equal(lateRes.body.message, 'Runde bereits gestartet.');
});

test('POST /api/rounds/join doppelter Beitritt gibt 409', async () => {
  const hostToken = await registerAndGetToken(app, 'hostDupCode');
  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));
  const { inviteCode } = createRes.body.game;

  const dupToken = await registerAndGetToken(app, 'dupPlayer');
  await request(app)
    .post('/api/rounds/join')
    .set(asUser(dupToken))
    .send({ inviteCode });

  const dupRes = await request(app)
    .post('/api/rounds/join')
    .set(asUser(dupToken))
    .send({ inviteCode });

  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.body.message, 'Du bist bereits in dieser Runde.');
});

test('POST /api/rounds/join unter 16 Jahren wird abgewiesen', async () => {
  const hostToken = await registerAndGetToken(app, 'hostAgeCode');
  const createRes = await request(app)
    .post('/api/games')
    .set(asUser(hostToken));
  const { inviteCode } = createRes.body.game;

  const youngToken = await createTestUser('youngCode', 'youngcode@test.de', 'GeheimesPasswort123', '2015-06-01');
  const joinRes = await request(app)
    .post('/api/rounds/join')
    .set(asUser(youngToken))
    .send({ inviteCode });

  assert.equal(joinRes.status, 403);
  assert.equal(joinRes.body.message, 'Mindestalter nicht erfüllt.');
});
