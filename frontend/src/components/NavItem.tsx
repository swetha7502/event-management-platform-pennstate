import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}

export default function NavItem({ icon: Icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
        active
          ? "bg-white text-blue-800"
          : "text-blue-100 hover:bg-blue-800/60 hover:text-white"
      }`}
    >
      <span className="relative">
        <Icon size={18} strokeWidth={2} />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-blue-900" />
        )}
      </span>
      {label}
    </button>
  );
}
