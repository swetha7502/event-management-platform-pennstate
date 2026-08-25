import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole } from '../middleware/auth';

export const eventsRouter = Router();

// GET /events - list all events (any authenticated user)
eventsRouter.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /events/:id - single event detail
eventsRouter.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Event not found' });
  res.json(data);
});

// POST /events - create (Coordinator only)
eventsRouter.post('/', requireAuth, requireRole('Coordinator'), async (req, res) => {
  const { title, description, date, location, budget, cultural_calendar_tag } = req.body;

  if (!title || !date) {
    return res.status(400).json({ error: 'title and date are required' });
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      title,
      description,
      date,
      location,
      budget,
      cultural_calendar_tag,
      created_by: req.user!.user_id,
      status: 'draft',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /events/:id - edit (Coordinator only)
eventsRouter.patch('/:id', requireAuth, requireRole('Coordinator'), async (req, res) => {
  const allowedFields = [
    'title', 'description', 'date', 'location', 'budget',
    'status', 'cultural_calendar_tag', 'predicted_attendance',
    'prediction_confidence', 'actual_attendance',
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('event_id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /events/:id - Coordinator only
eventsRouter.delete('/:id', requireAuth, requireRole('Coordinator'), async (req, res) => {
  const { error } = await supabase.from('events').delete().eq('event_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
