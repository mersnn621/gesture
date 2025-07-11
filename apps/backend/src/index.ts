import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Express API!');
});

app.listen(port, () => {
  console.log(`Express API listening on port ${port}`);
});