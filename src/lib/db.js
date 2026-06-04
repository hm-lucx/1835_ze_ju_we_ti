function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return require('./prisma');
  } catch (err) {
    console.warn('[WARN] Prisma nicht verfügbar – verwende In-Memory-Speicher.', err.message);
    return null;
  }
}

module.exports = { getDb };
