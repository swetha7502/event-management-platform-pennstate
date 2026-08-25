import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, X, Paperclip, User } from "lucide-react";
import { STATUS_META } from "../components/StatusBadge";
import TaskCard from "../components/TaskCard";
import { useAuth } from "../context/AuthContext";
import {
  getTasks,
  getStudents,
  getUpcomingEvents,
  createTask,
  updateTask,
  deleteTask,
} from "../lib/dataClient";
import type { OutletContextType, Student, Task, TaskStatus } from "../types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "not_started", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Completed" },
];

interface EventOption {
  event_id: string;
  title: string;
}

const BLANK_NEW_TASK = { title: "", description: "", assignee: "", due: "", attachment: "", event_id: "" };

export default function TasksPage() {
  const { session } = useAuth();
  const { showToast } = useOutletContext<OutletContextType>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState(BLANK_NEW_TASK);

  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  // Students default to seeing only their own tasks; Coordinators
  // default to the full board. Either can toggle.
  const [filterMine, setFilterMine] = useState(() => session?.role === "Student");

  useEffect(() => {
    getTasks()
      .then(setTasks)
      .catch(() => showToast("Couldn't load tasks"));
    getStudents()
      .then((s) => {
        setStudents(s);
        setNewTask((t) => ({ ...t, assignee: s[0]?.user_id ?? "" }));
      })
      .catch(() => showToast("Couldn't load students"));
    getUpcomingEvents()
      .then((data) => {
        const opts = (data as EventOption[]).map((e) => ({ event_id: e.event_id, title: e.title }));
        setEvents(opts);
        setNewTask((t) => ({ ...t, event_id: opts[0]?.event_id ?? "" }));
      })
      .catch(() => showToast("Couldn't load events"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentMap = useMemo(
    () => Object.fromEntries(students.map((s) => [s.user_id, s.name])),
    [students]
  );

  if (!session) return null;
  const canDelete = session.role === "Coordinator";

  const visibleTasks = filterMine ? tasks.filter((t) => t.assigned_to === session.userId) : tasks;

  const moveTask = (taskId: string, status: TaskStatus) => {
    const current = tasks.find((t) => t.task_id === taskId);
    if (!current || current.status === status) return;
    setTasks((ts) => ts.map((t) => (t.task_id === taskId ? { ...t, status } : t)));
    updateTask(taskId, { status }).catch(() => showToast("Failed to save move — try again"));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveTask(id, status);
    setDragOverStatus(null);
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    if (!newTask.event_id) {
      showToast("No event to attach this task to yet");
      return;
    }
    try {
      const created = await createTask({
        event_id: newTask.event_id,
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        assigned_to: newTask.assignee || null,
        due_date: newTask.due || null,
        attachment_url: newTask.attachment.trim() || null,
        created_by: session.userId ?? "unknown",
      });
      setTasks((ts) => [...ts, created]);
      showToast("Task created");
    } catch {
      showToast("Failed to create task");
    }
    setNewTask({ ...BLANK_NEW_TASK, assignee: students[0]?.user_id ?? "", event_id: newTask.event_id });
    setShowAdd(false);
  };

  const saveDetail = async () => {
    if (!detailTask) return;
    const { task_id, title, description, assigned_to, due_date, attachment_url, status } = detailTask;
    // attachment_url only included when it actually has a value — the
    // column is an optional add-on (see dataClient.ts createTask note);
    // sending it as null when the column doesn't exist yet would fail
    // the whole save, not just the attachment field.
    const patch: Partial<Task> = {
      title: title.trim(),
      description: description.trim(),
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      status,
    };
    if (attachment_url?.trim()) patch.attachment_url = attachment_url.trim();
    setTasks((ts) => ts.map((t) => (t.task_id === task_id ? { ...t, ...patch } : t)));
    setDetailTask(null);
    setSaving(true);
    try {
      await updateTask(task_id, patch);
      showToast("Task updated");
    } catch {
      showToast("Failed to save changes");
    }
    setSaving(false);
  };

  const removeDetailTask = async () => {
    if (!detailTask) return;
    const id = detailTask.task_id;
    setTasks((ts) => ts.filter((t) => t.task_id !== id));
    setDetailTask(null);
    try {
      await deleteTask(id);
      showToast("Task deleted");
    } catch {
      showToast("Failed to delete task");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Tasks</h2>
          <p className="text-sm text-slate-500">Drag a card to update its status</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-medium">
            <button
              onClick={() => setFilterMine(false)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                !filterMine ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"
              }`}
            >
              All tasks
            </button>
            <button
              onClick={() => setFilterMine(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                filterMine ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"
              }`}
            >
              <User size={12} /> My tasks
            </button>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Plus size={16} /> Add task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.status === col.status);
          const meta = STATUS_META[col.status];
          const isOver = dragOverStatus === col.status;
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStatus(col.status);
              }}
              onDragLeave={() => setDragOverStatus((cur) => (cur === col.status ? null : cur))}
              onDrop={(e) => handleDrop(e, col.status)}
              className={`rounded-xl border p-3 min-h-[320px] transition-colors ${
                isOver ? "border-blue-400 bg-blue-50/60" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="text-xs text-slate-400 ml-auto bg-white border border-slate-200 rounded-full px-2 py-0.5">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {colTasks.map((t) => (
                  <TaskCard
                    key={t.task_id}
                    task={t}
                    assigneeName={t.assigned_to ? studentMap[t.assigned_to] : undefined}
                    onOpen={() => setDetailTask({ ...t })}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.task_id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragTaskId(t.task_id);
                    }}
                    onDragEnd={() => {
                      setDragTaskId(null);
                      setDragOverStatus(null);
                    }}
                    dragging={dragTaskId === t.task_id}
                  />
                ))}
                {colTasks.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    {isOver ? "Drop here" : filterMine ? "No tasks assigned to you" : "No tasks"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add task */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Add task</h3>

            <label className="text-xs font-medium text-slate-500 block mb-1">Title</label>
            <input
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="e.g. Design event poster"
            />

            <label className="text-xs font-medium text-slate-500 block mb-1">Description</label>
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none"
              rows={3}
              placeholder="Any details worth noting..."
            />

            {events.length > 0 && (
              <>
                <label className="text-xs font-medium text-slate-500 block mb-1">Event</label>
                <select
                  value={newTask.event_id}
                  onChange={(e) => setNewTask({ ...newTask, event_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
                >
                  {events.map((e) => (
                    <option key={e.event_id} value={e.event_id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="text-xs font-medium text-slate-500 block mb-1">Assign to</label>
            <select
              value={newTask.assignee}
              onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            >
              <option value="">Unassigned</option>
              {students.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.name}
                </option>
              ))}
            </select>

            <label className="text-xs font-medium text-slate-500 block mb-1">Due date</label>
            <input
              type="date"
              value={newTask.due}
              onChange={(e) => setNewTask({ ...newTask, due: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs font-medium text-slate-500 block mb-1">
              Attachment link (optional)
            </label>
            <input
              value={newTask.attachment}
              onChange={(e) => setNewTask({ ...newTask, attachment: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-5"
              placeholder="https://drive.google.com/..."
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewTask({ ...BLANK_NEW_TASK, assignee: students[0]?.user_id ?? "", event_id: newTask.event_id });
                }}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={addTask}
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task detail */}
      {detailTask && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <input
                value={detailTask.title}
                onChange={(e) => setDetailTask({ ...detailTask, title: e.target.value })}
                className="text-sm font-semibold text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none flex-1 mr-3 pb-0.5"
              />
              <button
                onClick={() => setDetailTask(null)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
            <select
              value={detailTask.status}
              onChange={(e) => setDetailTask({ ...detailTask, status: e.target.value as TaskStatus })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            >
              {COLUMNS.map((c) => (
                <option key={c.status} value={c.status}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="text-xs font-medium text-slate-500 block mb-1">Description</label>
            <textarea
              value={detailTask.description}
              onChange={(e) => setDetailTask({ ...detailTask, description: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none"
              rows={4}
              placeholder="Add more detail about this task..."
            />

            <label className="text-xs font-medium text-slate-500 block mb-1">Assign to</label>
            <select
              value={detailTask.assigned_to ?? ""}
              onChange={(e) => setDetailTask({ ...detailTask, assigned_to: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            >
              <option value="">Unassigned</option>
              {students.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.name}
                </option>
              ))}
            </select>

            <label className="text-xs font-medium text-slate-500 block mb-1">Due date</label>
            <input
              type="date"
              value={detailTask.due_date ?? ""}
              onChange={(e) => setDetailTask({ ...detailTask, due_date: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <label className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
              <Paperclip size={11} /> Attachment link
            </label>
            <input
              value={detailTask.attachment_url ?? ""}
              onChange={(e) => setDetailTask({ ...detailTask, attachment_url: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-5"
              placeholder="https://drive.google.com/..."
            />

            <div className="flex gap-2">
              {canDelete && (
                <button
                  onClick={removeDetailTask}
                  className="border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium py-2 px-3 rounded-lg flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button
                onClick={() => setDetailTask(null)}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveDetail}
                disabled={saving}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
