function getDb() {
  return require('./prisma');
}

module.exports = { getDb };
