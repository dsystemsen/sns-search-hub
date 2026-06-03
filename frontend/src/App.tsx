import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

// Auth pages stay eager — they're the first thing unauthenticated users see.
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const AppShell = lazy(() => import("./layout/AppShell").then((m) => ({ default: m.AppShell })));

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const ChannelsPage = lazy(() =>
  import("./pages/ChannelsPage").then((m) => ({ default: m.ChannelsPage }))
);
const ChannelDetailPage = lazy(() =>
  import("./pages/ChannelDetailPage").then((m) => ({ default: m.ChannelDetailPage }))
);
const CompetitorsPage = lazy(() =>
  import("./pages/CompetitorsPage").then((m) => ({ default: m.CompetitorsPage }))
);
const CompetitorDetailPage = lazy(() =>
  import("./pages/CompetitorDetailPage").then((m) => ({ default: m.CompetitorDetailPage }))
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage }))
);
const NewPlanPage = lazy(() =>
  import("./pages/NewPlanPage").then((m) => ({ default: m.NewPlanPage }))
);
const PlanDetailPage = lazy(() =>
  import("./pages/PlanDetailPage").then((m) => ({ default: m.PlanDetailPage }))
);
const CommentsPage = lazy(() =>
  import("./pages/CommentsPage").then((m) => ({ default: m.CommentsPage }))
);
const KeywordsPage = lazy(() =>
  import("./pages/KeywordsPage").then((m) => ({ default: m.KeywordsPage }))
);
const ImportsPage = lazy(() =>
  import("./pages/ImportsPage").then((m) => ({ default: m.ImportsPage }))
);
const BillingPage = lazy(() =>
  import("./pages/BillingPage").then((m) => ({ default: m.BillingPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">読み込み中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const SuspenseFallback = () => <div className="loading">読み込み中...</div>;

export default function App() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/:id" element={<ChannelDetailPage />} />
          <Route path="competitors" element={<CompetitorsPage />} />
          <Route path="competitors/:id" element={<CompetitorDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="calendar/new" element={<NewPlanPage />} />
          <Route path="calendar/:id" element={<PlanDetailPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="keywords" element={<KeywordsPage />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="team" element={<PlaceholderPage title="チーム" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
