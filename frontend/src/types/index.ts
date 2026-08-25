// These mirror the Supabase Postgres schema (001_init_schema.sql).
// Keeping frontend types in lockstep with the DB enums means the
// backend swap-in later is just a data-layer change, not a type rewrite.

export type UserRole = "Coordinator" | "Student";

export interface User {
  user_id: string; // UUID
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type EventStatus =
  | "draft"
  | "planned"
  | "approved"
  | "completed"
  | "cancelled";

export type PredictionConfidence = "high" | "medium" | "low";

export interface Event {
  event_id: string;
  title: string;
  description: string;
  date: string; // ISO datetime
  location: string;
  budget: number;
  status: EventStatus;
  created_by: string; // FK -> User
  cultural_calendar_tag: string | null;
  predicted_attendance: number | null;
  prediction_confidence: PredictionConfidence | null;
  actual_attendance: number | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "not_started" | "in_progress" | "done";

export interface Task {
  task_id: string;
  event_id: string;
  title: string;
  description: string;
  assigned_to: string | null; // FK -> User (user_id)
  status: TaskStatus;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Link to an externally-hosted file (Drive/Dropbox/etc). Real uploads
  // to Supabase Storage are a later step — see frontend README.
  attachment_url?: string | null;
}

export interface Student {
  user_id: string;
  name: string;
}

export type RsvpResponse = "yes" | "no" | "maybe";

export interface Rsvp {
  rsvp_id: string;
  event_id: string;
  response: RsvpResponse;
  submitted_at: string;
}

export interface InventoryItem {
  item_id: string;
  name: string;
  category: string;
  count: number;
}

export interface AttendanceLog {
  log_id: string;
  event_id: string;
  actual_attendance: number;
  logged_by: string; // FK -> User
  logged_at: string;
}

export interface FoodLog {
  log_id: string;
  event_id: string;
  headcount_given: number;
  actual_attendance: number;
  waste_estimate: number; // positive = surplus/over-ordered, negative = ran short
  logged_by: string; // FK -> User
  logged_at: string;
}

// ---- Session (auth placeholder, matches AuthContext) ----
export interface Session {
  role: UserRole;
  name: string;
  userId?: string;
}

// Shared down through <Outlet context={...}> so any routed page can
// fire a toast without prop-drilling it through AppLayout.
export interface OutletContextType {
  showToast: (message: string) => void;
}
