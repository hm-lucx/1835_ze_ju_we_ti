require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL muss gesetzt sein.');
  process.exit(1);
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET muss in Produktion gesetzt sein.');
  process.exit(1);
}

const { execSync } = require('node:child_process');
try {
  require.resolve('./generated/prisma');
} catch {
  console.log('[BOOT] Prisma-Client fehlt – führe generate aus…');
  execSync('npx prisma generate', { stdio: 'inherit' });
}

const { createApp } = require('./app');

const app = createApp();
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
