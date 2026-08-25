import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, Clock, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAllEvents, completeEvent } from "../lib/dataClient";
import type { Event, OutletContextType } from "../types";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#64748B", bg: "#F1F5F9" },
  planned: { label: "Planned", color: "#B45309", bg: "#FEF3C7" },
  approved: { label: "Approved", color: "#1D4ED8", bg: "#DBEAFE" },
  completed: { label: "Completed", color: "#15803D", bg: "#DCFCE7" },
  cancelled: { label: "Cancelled", color: "#B91C1C", bg: "#FEE2E2" },
};

function isPastDue(dateStr: string) {
  return new Date(dateStr) < new Date();
}

export default function EventsPage() {
  const { session } = useAuth();
  const { showToast } = useOutletContext<OutletContextType>();
  const [events, setEvents] = useState<Event[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState("");
  const [foodGiven, setFoodGiven] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => getAllEvents().then(setEvents).catch(() => showToast("Couldn't load events"));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return null;
  const canComplete = session.role === "Coordinator";

  const startComplete = (eventId: string) => {
    setCompletingId(eventId);
    setAttendance("");
    setFoodGiven("");
  };

  const submitComplete = async () => {
    if (!completingId) return;
    const actualAttendance = Number(attendance);
    if (!attendance || Number.isNaN(actualAttendance) || actualAttendance < 0) {
      showToast("Enter a valid attendance number");
      return;
    }
    if (!session.userId) {
      showToast("Couldn't resolve your account — try logging in again");
      return;
    }
    setSaving(true);
    try {
      await completeEvent(completingId, {
        actualAttendance,
        foodHeadcountGiven: foodGiven ? Number(foodGiven) : null,
        loggedBy: session.userId,
      });
      showToast("Event marked complete — it'll now feed future predictions");
      setCompletingId(null);
      load();
    } catch {
      showToast("Failed to save — try again");
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-1">Events</h2>
      <p className="text-sm text-slate-500 mb-6">
        Every event GEO has run or is planning. Mark a past event complete to feed its real numbers back into future predictions.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-slate-100">
          {events.map((e) => {
            const meta = STATUS_META[e.status] ?? STATUS_META.draft;
            const needsCompletion =
              canComplete && (e.status === "planned" || e.status === "approved") && isPastDue(e.date);
            const isCompleting = completingId === e.event_id;

            return (
              <div key={e.event_id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{e.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(e.date).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {e.status === "completed" && e.actual_attendance !== null && (
                        <> · {e.actual_attendance} attended</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: meta.color, backgroundColor: meta.bg }}
                    >
                      {meta.label}
                    </span>
                    {needsCompletion && !isCompleting && (
                      <button
                        onClick={() => startComplete(e.event_id)}
                        className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                      >
                        <CheckCircle2 size={13} /> Mark completed
                      </button>
                    )}
                    {needsCompletion === false &&
                      (e.status === "planned" || e.status === "approved") &&
                      !isPastDue(e.date) && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={11} /> upcoming
                        </span>
                      )}
                  </div>
                </div>

                {isCompleting && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700">Record what actually happened</p>
                      <button onClick={() => setCompletingId(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 block mb-1">
                          Actual attendance *
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={attendance}
                          onChange={(e) => setAttendance(e.target.value)}
                          className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm"
                          placeholder="e.g. 280"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 block mb-1">
                          Food headcount ordered (optional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={foodGiven}
                          onChange={(e) => setFoodGiven(e.target.value)}
                          className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm"
                          placeholder="e.g. 300"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCompletingId(null)}
                        className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitComplete}
                        disabled={saving}
                        className="text-xs bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white px-3 py-1.5 rounded-md"
                      >
                        {saving ? "Saving…" : "Save & complete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">No events yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
