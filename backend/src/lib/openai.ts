import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// .trim() matters here — a dashboard-pasted env var (Render, etc.) can
// carry a trailing newline invisibly, which node-fetch's Headers then
// rejects outright ("is not a legal HTTP header value") when it's
// baked into the Authorization header. Cost a real debugging session
// to find; trim every secret read from process.env, not just this one.
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  throw new Error('Missing OPENAI_API_KEY in .env — copy .env.example to .env and fill it in.');
}

export const openai = new OpenAI({ apiKey });
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5-nano';
