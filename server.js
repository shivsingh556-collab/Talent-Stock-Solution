import express from 'express';
import path from 'path';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.static(process.cwd()));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`TSS Resume Intelligence server running on http://${HOST}:${PORT}`);
});
