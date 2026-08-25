import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  ListChecks,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  Boxes,
  LogOut,
} from "lucide-react";
import NavItem from "./NavItem";
import Toast from "./Toast";
import { useAuth } from "../context/AuthContext";
import { useDraft } from "../context/DraftContext";
import { useToast } from "../context/useToast";
import type { OutletContextType } from "../types";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/review", label: "Plan review", icon: ClipboardCheck, coordinatorOnly: true },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/inventory", label: "Inventory", icon: Boxes },
];

export default function AppLayout() {
  const { session, logout } = useAuth();
  const { pendingDraft } = useDraft();
  const navigate = useNavigate();
  const toast = useToast();

  if (!session) return null; // ProtectedRoute handles the redirect

  const visibleNav = NAV.filter((n) => !n.coordinatorOnly || session.role === "Coordinator");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const outletContext: OutletContextType = { showToast: toast.showToast };

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex text-slate-800">
        <aside className="w-60 bg-blue-900 flex flex-col shrink-0">
          <div className="px-5 py-5 border-b border-blue-800/60">
            <p className="text-white font-semibold text-sm leading-tight">
              Global Engagement
            </p>
            <p className="text-blue-300 text-xs">Office Platform</p>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {visibleNav.map((n) => (
              <NavLink key={n.to} to={n.to}>
                {({ isActive }) => (
                  <NavItem
                    icon={n.icon}
                    label={n.label}
                    active={isActive}
                    onClick={() => navigate(n.to)}
                    badge={n.to === "/review" && !!pendingDraft}
                  />
                )}
              </NavLink>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-blue-800/60">
            <div className="flex items-center gap-2 px-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-semibold">
                {session.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{session.name}</p>
                <p className="text-blue-300 text-[11px] capitalize">{session.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-blue-200 hover:text-white hover:bg-blue-800/60 rounded-lg text-xs font-medium"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet context={outletContext} />
        </main>

        <Toast message={toast.message} onClose={toast.clear} />
      </div>
    </>
  );
}
