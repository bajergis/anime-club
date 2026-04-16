import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { db } from './db.js';
import assignmentsRouter from './routes/assignments.js';
import animeRouter from './routes/anime.js';
import membersRouter from './routes/members.js';
import seasonsRouter from './routes/seasons.js';
import statsRouter from './routes/stats.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use('/api/assignments', assignmentsRouter);
app.use('/api/anime', animeRouter);
app.use('/api/members', membersRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/stats', statsRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`API running on :${PORT}`));
export default app;
