const { createApp } = require('./app');

const app = createApp();
const port = process.env.PORT || 3000;

app.use(require('express').static('.'));

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Auth server listening on port ${port}`);
});
