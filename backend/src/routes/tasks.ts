import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth, requireRole } from '../middleware/auth';

export const tasksRouter = Router();

// GET /tasks?event_id=... - list tasks, optionally filtered by event
tasksRouter.get('/', requireAuth, async (req, res) => {
  let query = supabase.from('tasks').select('*').order('due_date', { ascending: true });
  if (req.query.event_id) query = query.eq('event_id', req.query.event_id as string);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /tasks/mine - tasks assigned to the current user
tasksRouter.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', req.user!.user_id)
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /tasks - create (either role can create per current plan)
tasksRouter.post('/', requireAuth, async (req, res) => {
  const { event_id, title, description, assigned_to, due_date } = req.body;

  if (!event_id || !title) {
    return res.status(400).json({ error: 'event_id and title are required' });
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      event_id,
      title,
      description,
      assigned_to,
      due_date,
      created_by: req.user!.user_id,
      status: 'not_started',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /tasks/:id - edit/reassign (Students can edit/reassign, per plan)
tasksRouter.patch('/:id', requireAuth, async (req, res) => {
  const allowedFields = ['title', 'description', 'assigned_to', 'status', 'due_date'];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('task_id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /tasks/:id - Coordinator only
tasksRouter.delete('/:id', requireAuth, requireRole('Coordinator'), async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('task_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
