import type { Task, InventoryItem, Student } from "../types";

// This file is the ONLY place that should need to change when the
// backend/Supabase connection gets wired in. Each export here has a
// matching function name planned in src/lib/dataClient.ts so pages
// never import mockData directly — they go through dataClient.

export const STUDENTS: Student[] = [
  { user_id: "mock-aarav", name: "Aarav Mehta" },
  { user_id: "mock-priya", name: "Priya Nair" },
  { user_id: "mock-wei", name: "Wei Chen" },
  { user_id: "mock-sofia", name: "Sofia Alvarez" },
  { user_id: "mock-daniel", name: "Daniel Osei" },
  { user_id: "mock-mina", name: "Mina Park" },
];

export const INITIAL_TASKS: Task[] = [
  {
    task_id: "t1",
    event_id: "e_holi_2027",
    title: "Book main hall (HUB 218)",
    description: "Waiting on confirmation from Events Office.",
    assigned_to: "mock-aarav",
    status: "in_progress",
    due_date: "2026-08-10",
    created_by: "mock-coordinator",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    attachment_url: null,
  },
  {
    task_id: "t2",
    event_id: "e_holi_2027",
    title: "Order decorations & rangoli supplies",
    description: "",
    assigned_to: "mock-priya",
    status: "not_started",
    due_date: "2026-08-12",
    created_by: "mock-coordinator",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    attachment_url: null,
  },
  {
    task_id: "t3",
    event_id: "e_holi_2027",
    title: "Confirm catering headcount",
    description: "Confirmed with Peaceful Bites Catering.",
    assigned_to: "mock-wei",
    status: "done",
    due_date: "2026-08-14",
    created_by: "mock-coordinator",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    attachment_url: "https://drive.google.com/example-catering-quote",
  },
];

export const INVENTORY: InventoryItem[] = [
  { item_id: "i1", name: "Folding chairs", category: "Furniture", count: 120 },
  { item_id: "i2", name: "String lights (sets)", category: "Decor", count: 18 },
  { item_id: "i3", name: "Serving trays", category: "Catering", count: 34 },
  { item_id: "i4", name: "Table cloths", category: "Decor", count: 26 },
  { item_id: "i5", name: "Bluetooth speakers", category: "AV", count: 4 },
];

// No real "expected attendance" or dollar cost exists in the schema
// for historical events (predicted_attendance/budget are null on every
// completed event) — these two charts only show columns that are
// actually real: attendance, and food given-vs-attendance.
export const ATTENDANCE_HISTORY = [
  { event: "Diwali '25", actual: 206 },
  { event: "Navratri '25", actual: 165 },
  { event: "Worldfest '25", actual: 294 },
  { event: "Mid-Autumn '25", actual: 212 },
];

export const FOOD_ACCURACY = [
  { event: "Diwali '25", given: 225, actual: 206 },
  { event: "Navratri '25", given: 225, actual: 165 },
  { event: "Worldfest '25", given: 250, actual: 294 },
  { event: "Mid-Autumn '25", given: 240, actual: 212 },
];

// Shaped to match real Event rows (event_id/title/date/cultural_calendar_tag)
// so DashboardPage/TasksPage don't need a mock-vs-Supabase branch.
export const UPCOMING_EVENTS = [
  { event_id: "e_holi_2027", title: "Holi Celebration", date: "2027-03-14", cultural_calendar_tag: "Cultural" },
  { event_id: "e_food_fair_2026", title: "International Food Fair", date: "2026-11-02", cultural_calendar_tag: "Community" },
  { event_id: "e_careers_2026", title: "Global Careers Night", date: "2026-10-09", cultural_calendar_tag: "Professional" },
];

export const QUICK_STATS = [
  { label: "Events this year", value: "3" },
  { label: "Avg. attendance", value: "219" },
  { label: "Total students engaged", value: "877" },
  { label: "Food order accuracy", value: "89%" },
];
