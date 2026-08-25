import { useEffect, useState } from "react";
import { Navigate, useOutletContext } from "react-router-dom";
import {
  Check,
  X,
  Pencil,
  Users,
  UtensilsCrossed,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { useDraft } from "../context/DraftContext";
import { useAuth } from "../context/AuthContext";
import { createEvent, createTask, getStudents } from "../lib/dataClient";
import type { DraftTaskItem } from "../context/DraftContext";
import type { EventPhase } from "../data/taskTemplates";
import type { OutletContextType, Student } from "../types";

const PHASE_LABEL: Record<EventPhase, string> = {
  before: "Before the event",
  during: "Day of the event",
  after: "After the event",
};
const PHASE_ORDER: EventPhase[] = ["before", "during", "after"];

export default function ReviewPage() {
  const { pendingDraft, setPendingDraft, updateDraftTask, setDraftEventId } = useDraft();
  const { session } = useAuth();
  const { showToast } = useOutletContext<OutletContextType>();
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DraftTaskItem>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getStudents().then(setStudents).catch(() => {});
  }, []);

  if (!session) return null;
  // Coordinator-only page — Students get redirected, not just hidden nav.
  if (session.role !== "Coordinator") return <Navigate to="/dashboard" replace />;

  if (!pendingDraft) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Plan review</h2>
        <p className="text-sm text-slate-500 mb-6">
          Drafts from the AI assistant show up here for approval.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
          No pending drafts. Ask the AI assistant about your next event to generate one.
        </div>
      </div>
    );
  }

  const startEdit = (t: DraftTaskItem) => {
    setEditingId(t.id);
    setDraft({ ...t });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateDraftTask(editingId, draft);
    setEditingId(null);
  };

  // Creates the event on the very first task approval in this draft;
  // every later approval in the same draft reuses that event_id.
  const ensureEvent = async (): Promise<string | null> => {
    if (pendingDraft.eventId) return pendingDraft.eventId;
    if (!session.userId) return null;
    const event = await createEvent({
      title: pendingDraft.eventTitle,
      date: pendingDraft.eventDate,
      cultural_calendar_tag: pendingDraft.culturalTag,
      predicted_attendance: pendingDraft.predictedAttendance,
      prediction_confidence: pendingDraft.predictionConfidence,
      created_by: session.userId,
    });
    setDraftEventId(event.event_id);
    return event.event_id;
  };

  // Once a task is resolved (approved or discarded) it vanishes from
  // this list. Once none are left pending, the whole draft clears —
  // it's served its purpose.
  const otherPendingCount = (excludingId: string) =>
    pendingDraft.tasks.filter((x) => x.status === "pending" && x.id !== excludingId).length;

  const approveTask = async (t: DraftTaskItem) => {
    if (!session.userId) {
      showToast("Couldn't resolve your account — try logging in again");
      return;
    }
    setBusyId(t.id);
    try {
      const eventId = await ensureEvent();
      if (!eventId) throw new Error("no event");
      await createTask({
        event_id: eventId,
        title: t.title,
        description: t.description,
        assigned_to: t.assigned_to,
        due_date: t.due_date,
        created_by: session.userId,
      });
      if (otherPendingCount(t.id) === 0) {
        setPendingDraft(null);
        showToast(`"${t.title}" assigned — plan fully reviewed`);
      } else {
        updateDraftTask(t.id, { status: "approved" });
        showToast(`"${t.title}" assigned`);
      }
    } catch {
      showToast("Failed to approve that task — try again");
    }
    setBusyId(null);
  };

  const discardTask = (t: DraftTaskItem) => {
    if (otherPendingCount(t.id) === 0) {
      setPendingDraft(null);
      showToast("Plan fully reviewed");
    } else {
      updateDraftTask(t.id, { status: "discarded" });
    }
  };

  const discardDraft = () => {
    setPendingDraft(null);
    showToast("Draft discarded");
  };

  const pendingTasks = pendingDraft.tasks.filter((t) => t.status === "pending");

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold text-slate-800">Plan review</h2>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Drafted by the AI assistant — review, edit, and approve each task individually.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-800">{pendingDraft.eventTitle}</h3>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700">
            {pendingTasks.length} pending review
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {new Date(pendingDraft.eventDate + "T00:00:00").toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
            <Users size={15} className="text-blue-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {pendingDraft.attendanceRange
                  ? `${pendingDraft.attendanceRange.low}–${pendingDraft.attendanceRange.high}`
                  : (pendingDraft.predictedAttendance ?? "—")}{" "}
                students
              </p>
              <p className="text-[11px] text-slate-500 capitalize">
                {pendingDraft.predictionConfidence} confidence
              </p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
            <UtensilsCrossed size={15} className="text-blue-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {pendingDraft.recommendedFoodCount ?? "—"} servings
              </p>
              <p className="text-[11px] text-slate-500">Recommended food order</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <TrendingUp size={11} className="shrink-0" /> {pendingDraft.basisNote}
        </p>
      </div>

      {PHASE_ORDER.map((phase) => {
        const phaseTasks = pendingTasks.filter((t) => t.phase === phase);
        if (phaseTasks.length === 0) return null;
        return (
          <div key={phase} className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">{PHASE_LABEL[phase]}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {phaseTasks.map((t) => {
                const isEditing = editingId === t.id;
                const isBusy = busyId === t.id;
                return (
                  <div key={t.id} className="px-5 py-3.5">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={draft.title ?? ""}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                          className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm font-medium"
                        />
                        <textarea
                          value={draft.description ?? ""}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          rows={2}
                          className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-xs resize-none"
                        />
                        <div className="flex gap-2">
                          <select
                            value={draft.assigned_to ?? ""}
                            onChange={(e) => {
                              const s = students.find((s) => s.user_id === e.target.value);
                              setDraft({ ...draft, assigned_to: e.target.value || null, assigneeName: s?.name ?? "Unassigned" });
                            }}
                            className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                          >
                            <option value="">Unassigned</option>
                            {students.map((s) => (
                              <option key={s.user_id} value={s.user_id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={draft.due_date ?? ""}
                            onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                            className="border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            className="text-xs bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-md"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{t.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {t.assigneeName} · due {t.due_date}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(t)}
                            title="Edit"
                            className="text-slate-400 hover:text-blue-700 p-1.5"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => discardTask(t)}
                            title="Discard"
                            className="text-slate-400 hover:text-red-600 p-1.5"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() => approveTask(t)}
                            disabled={isBusy}
                            title="Approve & assign"
                            className="text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md p-1.5"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-end">
        <button
          onClick={discardDraft}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600"
        >
          <Trash2 size={13} /> Discard entire draft
        </button>
      </div>
    </div>
  );
}
