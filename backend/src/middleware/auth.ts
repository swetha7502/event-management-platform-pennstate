import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

// Extend Express's Request type so downstream handlers get typed req.user
declare global {
  namespace Express {
    interface Request {
      user?: { user_id: string; role: 'Coordinator' | 'Student'; email: string };
    }
  }
}

/**
 * PLACEHOLDER AUTH — v1 dev only.
 * Expects header: Authorization: Bearer <user_id>
 * Looks the user up in the `users` table and attaches it to req.user.
 *
 * Swap point for real SSO later: replace the body of this function with
 * real token verification (e.g. PSU SSO / JWT), keep the req.user contract
 * the same so nothing downstream has to change.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const userId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!userId) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('user_id, role, email')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: 'Invalid user' });
  }

  req.user = data as Express.Request['user'];
  next();
}

/** Restrict a route to specific roles, e.g. requireRole('Coordinator') */
export function requireRole(...roles: Array<'Coordinator' | 'Student'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
