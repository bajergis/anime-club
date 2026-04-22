import express from 'express';
import session from "express-session";
import "dotenv/config";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { db } from './db.js';
import assignmentsRouter from './routes/assignments.js';
import animeRouter from './routes/anime.js';
import membersRouter from './routes/members.js';
import seasonsRouter from './routes/seasons.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,    // set to true in prod when you have HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 30,  // 30 days
  }
}));
app.use('/api/assignments', assignmentsRouter);
app.use('/api/anime', animeRouter);
app.use('/api/members', membersRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/stats', statsRouter);
app.use('/auth', authRouter);
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`API running on :${PORT}`));
export default app;
