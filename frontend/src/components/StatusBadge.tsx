import type { TaskStatus } from "../types";

const STATUS_META: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: "To do", color: "#64748B", bg: "#F1F5F9" },
  in_progress: { label: "In progress", color: "#B45309", bg: "#FEF3C7" },
  done: { label: "Completed", color: "#15803D", bg: "#DCFCE7" },
};

export default function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

export { STATUS_META };
