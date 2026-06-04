require('dotenv').config();
const { createApp } = require('./app');

const app = createApp();
const port = process.env.PORT || 3000;

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET muss in Produktion gesetzt sein.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.warn('[WARN] DATABASE_URL nicht gesetzt – verwende In-Memory-Speicher. Daten sind nicht persistent!');
}

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
