import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Calendar, ListChecks, Boxes } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getTasks, getUpcomingEvents, getInventory } from "../lib/dataClient";
import type { InventoryItem, OutletContextType, Task } from "../types";

interface EventSummary {
  event_id: string;
  title: string;
  date: string;
  cultural_calendar_tag: string | null;
}

export default function DashboardPage() {
  const { session } = useAuth();
  const { showToast } = useOutletContext<OutletContextType>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    getTasks()
      .then(setTasks)
      .catch(() => showToast("Couldn't load tasks"));
    getUpcomingEvents()
      .then((data) => setEvents(data as EventSummary[]))
      .catch(() => showToast("Couldn't load events"));
    getInventory()
      .then(setInventory)
      .catch(() => showToast("Couldn't load inventory"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return null;
  const { role, name, userId } = session;

  const myOpenTasks = tasks.filter(
    (t) => t.status !== "done" && (role === "Coordinator" || t.assigned_to === userId)
  ).length;

  const nextEvent = events[0];
  const lowestStockItem = inventory.length
    ? inventory.reduce((min, it) => (it.count < min.count ? it : min))
    : null;

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-1">
        Welcome back, {name.split(" ")[0]}
      </h2>
      <p className="text-sm text-slate-500 mb-6">Here's what's happening across GEO events.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Calendar size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Next event</span>
          </div>
          <p className="text-lg font-semibold text-slate-800">
            {nextEvent ? nextEvent.title : "No upcoming events"}
          </p>
          <p className="text-xs text-slate-400">
            {nextEvent ? new Date(nextEvent.date).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <ListChecks size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Open tasks</span>
          </div>
          <p className="text-lg font-semibold text-slate-800">{myOpenTasks}</p>
          <p className="text-xs text-slate-400">
            {role === "Coordinator" ? "Across all students" : "Assigned to you"}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Boxes size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Low inventory</span>
          </div>
          <p className="text-lg font-semibold text-slate-800">
            {lowestStockItem ? lowestStockItem.name : "No inventory yet"}
          </p>
          <p className="text-xs text-slate-400">
            {lowestStockItem ? `${lowestStockItem.count} units remaining` : "—"}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Upcoming events</h3>
        <div className="divide-y divide-slate-100">
          {events.map((e) => (
            <div key={e.event_id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{e.title}</p>
                <p className="text-xs text-slate-400">
                  {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {e.cultural_calendar_tag && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  {e.cultural_calendar_tag}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
