import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('Missing OPENAI_API_KEY in .env — copy .env.example to .env and fill it in.');
}

export const openai = new OpenAI({ apiKey });
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano';
