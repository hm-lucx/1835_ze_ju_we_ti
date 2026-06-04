require('dotenv').config();
const { createApp } = require('./app');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL muss gesetzt sein.');
  process.exit(1);
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET muss in Produktion gesetzt sein.');
  process.exit(1);
}

const app = createApp();
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
