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
 * Real auth: expects header `Authorization: Bearer <supabase-access-token>`
 * — the real Supabase Auth session token (see frontend AuthContext.tsx /
 * aiClient.ts), not a raw user id. supabase.auth.getUser(token) verifies
 * the token cryptographically against Supabase before anything is trusted.
 *
 * Previously this trusted a raw `Bearer <user_id>` with no verification
 * at all — anyone who knew or could read a user_id (e.g. via the public
 * anon key) could impersonate that user. Fixed as part of the pre-launch
 * security pass, Aug 2026.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user?.email) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('user_id, role, email')
    .eq('email', authData.user.email)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: 'No matching user profile for this account' });
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
