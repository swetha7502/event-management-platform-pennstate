import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { eventsRouter } from './routes/events';
import { tasksRouter } from './routes/tasks';
import { aiRouter } from './routes/ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/events', eventsRouter);
app.use('/tasks', tasksRouter);
app.use('/ai', aiRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
