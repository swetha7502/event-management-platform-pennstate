import { Calendar, Paperclip } from "lucide-react";
import type { DragEvent } from "react";
import type { Task } from "../types";

interface TaskCardProps {
  task: Task;
  assigneeName: string | undefined;
  onOpen: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void;
  dragging: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Local-midnight comparison so a due date of "today" never reads overdue.
function isOverdue(dueDate: string) {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export default function TaskCard({
  task,
  assigneeName,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: TaskCardProps) {
  const overdue = task.due_date && task.status !== "done" && isOverdue(task.due_date);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-shadow cursor-pointer active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <p className="text-sm font-medium text-slate-800 mb-1.5">{task.title}</p>

      {task.description && (
        <p className="text-xs text-slate-500 mb-2.5 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {assigneeName ? (
            <>
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center">
                {initials(assigneeName)}
              </span>
              <span className="text-xs text-slate-500 truncate">{assigneeName}</span>
            </>
          ) : (
            <span className="text-xs text-slate-400 italic">Unassigned</span>
          )}
        </div>
        {task.attachment_url && (
          <a
            href={task.attachment_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-slate-400 hover:text-blue-700"
            title="Open attachment"
          >
            <Paperclip size={13} />
          </a>
        )}
      </div>

      {task.due_date && (
        <div
          className={`flex items-center gap-1 mt-2 text-[11px] ${
            overdue ? "text-red-600 font-medium" : "text-slate-400"
          }`}
        >
          <Calendar size={11} />
          {task.due_date}
        </div>
      )}
    </div>
  );
}
