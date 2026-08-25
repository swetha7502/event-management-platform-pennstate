import { createContext, useContext, useState, ReactNode } from "react";
import type { PredictionConfidence } from "../types";
import type { EventPhase } from "../data/taskTemplates";

export type DraftTaskStatus = "pending" | "approved" | "discarded";

export interface DraftTaskItem {
  id: string; // stable local id for this draft session, e.g. "dt-0"
  title: string;
  description: string;
  phase: EventPhase;
  due_date: string; // ISO date (yyyy-mm-dd)
  assigned_to: string | null; // user_id, pre-assigned round-robin across students
  assigneeName: string;
  status: DraftTaskStatus;
}

export interface PendingDraft {
  eventTitle: string;
  eventDate: string; // ISO date (yyyy-mm-dd)
  culturalTag: string | null;
  predictedAttendance: number | null;
  attendanceRange: { low: number; high: number } | null;
  predictionConfidence: PredictionConfidence;
  recommendedFoodCount: number | null;
  basisNote: string;
  tasks: DraftTaskItem[];
  // Set once the event is actually created in Supabase — lazily, on the
  // first task approval — so later per-task approvals in the same draft
  // reuse it instead of creating duplicate events.
  eventId: string | null;
}

interface DraftContextValue {
  pendingDraft: PendingDraft | null;
  setPendingDraft: (d: PendingDraft | null) => void;
  updateDraftTask: (taskId: string, patch: Partial<DraftTaskItem>) => void;
  setDraftEventId: (eventId: string) => void;
}

const DraftContext = createContext<DraftContextValue | undefined>(undefined);

// Holds the AI chat's most recent draft (event + task list) entirely
// in memory — nothing touches Supabase until a Coordinator approves
// each task individually on the Review page. Lost on refresh; that's a
// deliberate v1 tradeoff to avoid a "pending approval" DB migration for
// a single in-flight draft. Revisit if multiple concurrent drafts are
// ever needed.
export function DraftProvider({ children }: { children: ReactNode }) {
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);

  const updateDraftTask = (taskId: string, patch: Partial<DraftTaskItem>) => {
    setPendingDraft((d) =>
      d
        ? { ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
        : d
    );
  };

  const setDraftEventId = (eventId: string) => {
    setPendingDraft((d) => (d ? { ...d, eventId } : d));
  };

  return (
    <DraftContext.Provider value={{ pendingDraft, setPendingDraft, updateDraftTask, setDraftEventId }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within a DraftProvider");
  return ctx;
}
