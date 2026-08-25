// Single seam between pages and data. Every page imports FROM HERE,
// never from mockData.ts or supabaseClient.ts directly. That means
// wiring up the real backend later is a change confined to this file:
// flip VITE_USE_SUPABASE=true in .env.local and fill in the Supabase
// query bodies below — no page component needs to change.

import type { Event, InventoryItem, PredictionConfidence, Student, Task, TaskStatus, UserRole } from "../types";
import {
  INITIAL_TASKS,
  INVENTORY,
  ATTENDANCE_HISTORY,
  FOOD_ACCURACY,
  UPCOMING_EVENTS,
  QUICK_STATS,
  STUDENTS,
} from "../data/mockData";
import { supabase, USE_SUPABASE } from "./supabaseClient";

export async function getTasks(): Promise<Task[]> {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase.from("tasks").select("*");
    if (error) throw error;
    return data as Task[];
  }
  return Promise.resolve(INITIAL_TASKS);
}

export async function createTask(input: {
  event_id: string;
  title: string;
  description?: string;
  assigned_to?: string | null;
  due_date?: string | null;
  attachment_url?: string | null;
  created_by: string;
}): Promise<Task> {
  if (USE_SUPABASE && supabase) {
    // attachment_url is only included when actually provided — the
    // column is an optional add-on (see frontend README/SQL note) and
    // PostgREST rejects the whole insert if an unknown column key is
    // present at all, even set to null. This keeps task creation
    // working whether or not that column has been added yet.
    const row: Record<string, unknown> = {
      event_id: input.event_id,
      title: input.title,
      description: input.description ?? "",
      assigned_to: input.assigned_to ?? null,
      due_date: input.due_date ?? null,
      created_by: input.created_by,
      status: "not_started",
    };
    if (input.attachment_url !== undefined) row.attachment_url = input.attachment_url;

    const { data, error } = await supabase.from("tasks").insert(row).select().single();
    if (error) throw error;
    return data as Task;
  }
  const now = new Date().toISOString();
  return Promise.resolve({
    task_id: "t" + Date.now(),
    event_id: input.event_id,
    title: input.title,
    description: input.description ?? "",
    assigned_to: input.assigned_to ?? null,
    status: "not_started" as TaskStatus,
    due_date: input.due_date ?? null,
    attachment_url: input.attachment_url ?? null,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
  });
}

export async function updateTask(taskId: string, patch: Partial<Task>): Promise<void> {
  if (USE_SUPABASE && supabase) {
    const { error } = await supabase.from("tasks").update(patch).eq("task_id", taskId);
    if (error) throw error;
    return;
  }
  return Promise.resolve();
}

export async function deleteTask(taskId: string): Promise<void> {
  if (USE_SUPABASE && supabase) {
    const { error } = await supabase.from("tasks").delete().eq("task_id", taskId);
    if (error) throw error;
    return;
  }
  return Promise.resolve();
}

export async function getInventory(): Promise<InventoryItem[]> {
  if (USE_SUPABASE && supabase) {
    // NB: the DB column is `quantity_available`, not `count` — aliased
    // here so InventoryItem/InventoryPage don't need to change.
    const { data, error } = await supabase
      .from("inventory_items")
      .select("item_id, name, category, count:quantity_available");
    if (error) throw error;
    return data as InventoryItem[];
  }
  return Promise.resolve(INVENTORY);
}

export async function updateInventoryCount(itemId: string, count: number): Promise<void> {
  if (USE_SUPABASE && supabase) {
    const { error } = await supabase
      .from("inventory_items")
      .update({ quantity_available: count })
      .eq("item_id", itemId);
    if (error) throw error;
    return;
  }
  return Promise.resolve();
}

// NB: there's no real "expected attendance" (predicted_attendance is
// null on every historical completed event — it was never recorded)
// and no real dollar cost anywhere in the schema (budget is null on
// every historical event too). Only show columns that are actually
// real: attendance, and food given-vs-attendance.
export async function getAttendanceHistory(): Promise<{ event: string; actual: number }[]> {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase
      .from("events")
      .select("title, date, actual_attendance")
      .eq("status", "completed")
      .not("actual_attendance", "is", null)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((e) => ({
      event: `${e.title} '${e.date.slice(2, 4)}`,
      actual: e.actual_attendance as number,
    }));
  }
  return Promise.resolve(ATTENDANCE_HISTORY);
}

export async function getFoodAccuracy(): Promise<{ event: string; given: number; actual: number }[]> {
  if (USE_SUPABASE && supabase) {
    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("event_id, title, date")
      .eq("status", "completed")
      .order("date", { ascending: true });
    if (eventsErr) throw eventsErr;
    const eventIds = (events ?? []).map((e) => e.event_id);
    if (eventIds.length === 0) return [];

    const { data: foodRows, error: foodErr } = await supabase
      .from("food_logs")
      .select("event_id, headcount_given, actual_attendance")
      .in("event_id", eventIds);
    if (foodErr) throw foodErr;
    const foodByEvent = new Map((foodRows ?? []).map((f) => [f.event_id, f]));

    return (events ?? [])
      .map((e) => {
        const f = foodByEvent.get(e.event_id);
        if (!f) return null;
        return {
          event: `${e.title} '${e.date.slice(2, 4)}`,
          given: f.headcount_given as number,
          actual: f.actual_attendance as number,
        };
      })
      .filter((x): x is { event: string; given: number; actual: number } => x !== null);
  }
  return Promise.resolve(FOOD_ACCURACY);
}

export async function createEvent(input: {
  title: string;
  description?: string;
  date: string; // ISO date
  location?: string;
  budget?: number | null;
  cultural_calendar_tag?: string | null;
  predicted_attendance?: number | null;
  prediction_confidence?: PredictionConfidence | null;
  created_by: string;
}): Promise<{ event_id: string; title: string }> {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: input.title,
        description: input.description ?? "",
        date: input.date,
        location: input.location ?? "",
        budget: input.budget ?? null,
        // "planned" (not the API default "draft") since this only gets
        // written once a Coordinator has already approved it — it
        // should show up immediately in getUpcomingEvents().
        status: "planned",
        created_by: input.created_by,
        cultural_calendar_tag: input.cultural_calendar_tag ?? null,
        predicted_attendance: input.predicted_attendance ?? null,
        prediction_confidence: input.prediction_confidence ?? null,
      })
      .select("event_id, title")
      .single();
    if (error) throw error;
    return data;
  }
  return Promise.resolve({ event_id: "e" + Date.now(), title: input.title });
}

// NB: no predictEvent() here anymore — the AI chat calls the backend's
// /ai/chat route (src/lib/aiClient.ts), which runs the real prediction
// logic server-side (backend/src/lib/predict.ts) so it can be grounded
// via OpenAI function-calling. Keeping only one copy avoids the two
// drifting out of sync.

export async function getUpcomingEvents() {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("status", ["planned", "approved"])
      .order("date", { ascending: true });
    if (error) throw error;
    return data;
  }
  return Promise.resolve(UPCOMING_EVENTS);
}

export async function getQuickStats(): Promise<{ label: string; value: string }[]> {
  if (USE_SUPABASE && supabase) {
    const currentYear = new Date().getFullYear();
    const { data: allEvents, error: allErr } = await supabase.from("events").select("date").neq("status", "draft");
    if (allErr) throw allErr;
    const eventsThisYear = (allEvents ?? []).filter(
      (e) => new Date(e.date).getFullYear() === currentYear
    ).length;

    const { data: completed, error: compErr } = await supabase
      .from("events")
      .select("actual_attendance")
      .eq("status", "completed")
      .not("actual_attendance", "is", null);
    if (compErr) throw compErr;
    const attendances = (completed ?? []).map((e) => e.actual_attendance as number);
    const avgAttendance = attendances.length
      ? Math.round(attendances.reduce((a, b) => a + b, 0) / attendances.length)
      : null;
    const totalEngaged = attendances.reduce((a, b) => a + b, 0);

    const { data: foodRows, error: foodErr } = await supabase
      .from("food_logs")
      .select("headcount_given, actual_attendance");
    if (foodErr) throw foodErr;
    const accuracies = (foodRows ?? [])
      .filter((f) => f.actual_attendance > 0)
      .map((f) => 1 - Math.abs(f.headcount_given - f.actual_attendance) / f.actual_attendance);
    const avgAccuracy = accuracies.length
      ? Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 100)
      : null;

    return [
      { label: "Events this year", value: String(eventsThisYear) },
      { label: "Avg. attendance", value: avgAttendance !== null ? String(avgAttendance) : "—" },
      { label: "Total students engaged", value: totalEngaged.toLocaleString() },
      { label: "Food order accuracy", value: avgAccuracy !== null ? `${avgAccuracy}%` : "—" },
    ];
  }
  return Promise.resolve(QUICK_STATS);
}

export async function getAllEvents(): Promise<Event[]> {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false });
    if (error) throw error;
    return data as Event[];
  }
  return Promise.resolve(UPCOMING_EVENTS as unknown as Event[]);
}

// Closes the loop after a real event: marks it completed and records
// what actually happened, so it becomes real history for future
// predictions — same tables predictEvent()/getAttendanceHistory() read
// from. Writes to events, attendance_logs, and food_logs together.
export async function completeEvent(
  eventId: string,
  input: { actualAttendance: number; foodHeadcountGiven: number | null; loggedBy: string }
): Promise<void> {
  if (!(USE_SUPABASE && supabase)) return Promise.resolve();

  const { error: eventErr } = await supabase
    .from("events")
    .update({ status: "completed", actual_attendance: input.actualAttendance })
    .eq("event_id", eventId);
  if (eventErr) throw eventErr;

  const { error: attendanceErr } = await supabase.from("attendance_logs").insert({
    event_id: eventId,
    actual_attendance: input.actualAttendance,
    logged_by: input.loggedBy,
  });
  if (attendanceErr) throw attendanceErr;

  if (input.foodHeadcountGiven !== null) {
    // waste_estimate is a generated column (headcount_given - actual_attendance,
    // computed by the DB) — inserting a value for it is rejected outright.
    const { error: foodErr } = await supabase.from("food_logs").insert({
      event_id: eventId,
      headcount_given: input.foodHeadcountGiven,
      actual_attendance: input.actualAttendance,
      logged_by: input.loggedBy,
    });
    if (foodErr) throw foodErr;
  }
}

export async function getStudents(): Promise<Student[]> {
  if (USE_SUPABASE && supabase) {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, name")
      .eq("role", "Student");
    if (error) throw error;
    return data as Student[];
  }
  return Promise.resolve(STUDENTS);
}

// Placeholder-auth helper: looks up a `users` row by name+role, creating
// one if it doesn't exist yet, so session.userId is a real FK usable as
// tasks.created_by / assigned_to. Swap point noted in AuthContext.tsx —
// replace with real SSO/session lookup later, keep the return shape.
export interface UserProfile {
  user_id: string;
  name: string;
  role: UserRole;
}

// Real Supabase Auth handles *who you are* (email/password, sessions);
// this resolves that identity to *what you can do here* — the matching
// public.users row (role, display name, the FK id everything else in
// the app keys off). Login flow: AuthContext signs in via Supabase
// Auth, then calls this with the authenticated email.
export async function getUserProfile(email: string): Promise<UserProfile | null> {
  if (!(USE_SUPABASE && supabase)) {
    const match = STUDENTS.find((s) => s.name.toLowerCase() === email.toLowerCase());
    return match ? { user_id: match.user_id, name: match.name, role: "Student" } : null;
  }
  const { data, error } = await supabase
    .from("users")
    .select("user_id, name, role")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.error("getUserProfile failed:", error.message);
    return null;
  }
  return data;
}
