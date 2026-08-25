import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DraftProvider } from "./context/DraftContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import AIChatPage from "./pages/AIChatPage";
import TasksPage from "./pages/TasksPage";
import StatsPage from "./pages/StatsPage";
import InventoryPage from "./pages/InventoryPage";
import ReviewPage from "./pages/ReviewPage";
import EventsPage from "./pages/EventsPage";

export default function App() {
  return (
    <AuthProvider>
      <DraftProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/chat" element={<AIChatPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </DraftProvider>
    </AuthProvider>
  );
}
