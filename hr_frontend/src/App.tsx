import { Component, Suspense, lazy, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import AppShell from "./components/AppShell";
import { Button, EmptyState } from "./components/ui";
import { HrProvider, useHr } from "./store/HrContext";

const DashboardPage = lazy(() => import("./modules/hr/pages/DashboardPage"));
const CoursesPage = lazy(() => import("./modules/hr/pages/CoursesPage"));
const CourseDetailPage = lazy(
  () => import("./modules/hr/pages/CourseDetailPage"),
);
const CourseEditorPage = lazy(
  () => import("./modules/hr/pages/CourseEditorPage"),
);
const MyLearningPage = lazy(() => import("./modules/hr/pages/MyLearningPage"));
const ProgramsPage = lazy(() => import("./modules/hr/pages/ProgramsPage"));
const EmployeesPage = lazy(() => import("./modules/hr/pages/EmployeesPage"));
const AssignmentsPage = lazy(
  () => import("./modules/hr/pages/AssignmentsPage"),
);
const TestsPage = lazy(() => import("./modules/hr/pages/TestsPage"));
const TestEditorPage = lazy(() => import("./modules/hr/pages/TestEditorPage"));
const TestPlayerPage = lazy(() => import("./modules/hr/pages/TestPlayerPage"));
const ResultsPage = lazy(() => import("./modules/hr/pages/ResultsPage"));
const LibraryPage = lazy(() => import("./modules/hr/pages/LibraryPage"));
const NotificationsPage = lazy(
  () => import("./modules/hr/pages/NotificationsPage"),
);
const SettingsPage = lazy(() => import("./modules/hr/pages/SettingsPage"));

class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <EmptyState
        title="Не удалось открыть раздел"
        description="Обновите страницу. Сохранённые данные обучения останутся в этом браузере."
        action={
          <Button onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
        }
      />
    ) : (
      this.props.children
    );
  }
}

function HrOnly({ children }: { children: ReactNode }) {
  const { role } = useHr();
  return role === "hr" ? children : <Navigate to="/my-learning" replace />;
}

function Workspace() {
  const {
    state,
    role,
    employeeId,
    setRole,
    setEmployeeId,
    storageError,
    markNotificationRead,
  } = useHr();
  const location = useLocation();
  const employee = state.employees.find((item) => item.id === employeeId);
  const notifications = state.notifications.filter((item) =>
    role === "hr"
      ? item.audience === "hr" || item.audience === "all"
      : (item.audience === "all" || item.audience !== "hr") &&
        (!item.employeeId || item.employeeId === employeeId),
  );
  return (
    <AppShell
      role={role}
      onRoleChange={setRole}
      employeeName={
        role === "hr"
          ? "Жукенов Каримжан Амангельдыевич"
          : employee?.name || "Сотрудник"
      }
      employeeId={employeeId}
      employees={state.employees.filter((item) => item.status === "active")}
      onEmployeeChange={setEmployeeId}
      notifications={notifications}
      onNotificationRead={markNotificationRead}
      notificationsCount={notifications.filter((item) => !item.read).length}
    >
      {storageError && (
        <div role="alert" className="alert alert-error">
          {storageError}
        </div>
      )}
      <PageBoundary key={location.pathname}>
        <Suspense
          fallback={
            <section className="panel loading-state" role="status">
              Загрузка раздела…
            </section>
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                <Navigate
                  to={role === "hr" ? "/dashboard" : "/my-learning"}
                  replace
                />
              }
            />
            <Route
              path="/dashboard"
              element={
                <HrOnly>
                  <DashboardPage />
                </HrOnly>
              }
            />
            <Route path="/courses" element={<CoursesPage />} />
            <Route
              path="/courses/new"
              element={
                <HrOnly>
                  <CourseEditorPage />
                </HrOnly>
              }
            />
            <Route
              path="/courses/:id/edit"
              element={
                <HrOnly>
                  <CourseEditorPage />
                </HrOnly>
              }
            />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/my-learning" element={<MyLearningPage />} />
            <Route path="/programs" element={<ProgramsPage />} />
            <Route
              path="/employees"
              element={
                <HrOnly>
                  <EmployeesPage />
                </HrOnly>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <HrOnly>
                  <EmployeesPage />
                </HrOnly>
              }
            />
            <Route
              path="/assignments"
              element={
                <HrOnly>
                  <AssignmentsPage />
                </HrOnly>
              }
            />
            <Route
              path="/tests"
              element={
                <HrOnly>
                  <TestsPage />
                </HrOnly>
              }
            />
            <Route
              path="/tests/new"
              element={
                <HrOnly>
                  <TestEditorPage />
                </HrOnly>
              }
            />
            <Route
              path="/tests/:id/edit"
              element={
                <HrOnly>
                  <TestEditorPage />
                </HrOnly>
              }
            />
            <Route path="/tests/:id/take" element={<TestPlayerPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route
              path="/settings"
              element={
                <HrOnly>
                  <SettingsPage />
                </HrOnly>
              }
            />
            <Route
              path="*"
              element={
                <EmptyState
                  title="Раздел не найден"
                  description="Выберите нужный раздел в меню слева."
                />
              }
            />
          </Routes>
        </Suspense>
      </PageBoundary>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <HrProvider>
        <Workspace />
      </HrProvider>
    </BrowserRouter>
  );
}
