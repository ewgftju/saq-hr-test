import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, ChevronDown } from "lucide-react";
import SaqSidebar from "./SaqSidebar";
import type { HrRole } from "./SaqSidebar";

export interface AppShellProps extends PropsWithChildren {
  role: HrRole;
  onRoleChange: (role: HrRole) => void;
  employeeName: string;
  employeeId?: string;
  employees?: { id: string; name: string }[];
  onEmployeeChange?: (id: string) => void;
  notificationsCount?: number;
  notifications?: ShellNotification[];
  onNotificationRead?: (id: string) => void;
}

export interface ShellNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

const titles: Record<string, [string, string]> = {
  dashboard: [
    "Обзор обучения",
    "Развитие компетенций и контроль обучения сотрудников",
  ],
  courses: [
    "Курсы",
    "Учебные материалы, практические задания и итоговое тестирование",
  ],
  programs: ["Программы обучения", "Курсы и участники учебных программ"],
  employees: ["Сотрудники", "Учёт сотрудников и персональная история обучения"],
  assignments: [
    "Назначения",
    "Курсы, сроки и ответственные за прохождение обучения",
  ],
  tests: ["Тесты и вопросы", "Банк вопросов и настройка проверки знаний"],
  results: [
    "Результаты и отчёты",
    "Успеваемость, попытки тестирования и завершённое обучение",
  ],
  library: ["Библиотека", "Полезные материалы и документы для сотрудников"],
  notifications: ["Уведомления", "События и задачи по обучению"],
  settings: ["Настройки", "Параметры модуля и управление учебными данными"],
  "my-learning": ["Моё обучение", "Назначенные курсы, прогресс и результаты"],
};

export default function AppShell({
  role,
  onRoleChange,
  employeeName,
  employeeId,
  employees = [],
  onEmployeeChange,
  notificationsCount = 0,
  notifications = [],
  onNotificationRead,
  children,
}: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRoot = useRef<HTMLDivElement>(null);
  const section = location.pathname.split("/")[1];
  const [title, subtitle] = titles[section] || [
    "Кадры",
    "Обучение сотрудников SAQ",
  ];
  const initials = employeeName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const recentNotifications = [...notifications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname, role, employeeId]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const outside = (event: PointerEvent) => {
      if (!notificationsRoot.current?.contains(event.target as Node))
        setNotificationsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        notificationsRoot.current
          ?.querySelector<HTMLButtonElement>("button")
          ?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [notificationsOpen]);

  const notificationPath = (item: ShellNotification) => {
    if (
      item.href?.startsWith("/") &&
      !item.href.startsWith("//") &&
      !item.href.includes("\\")
    ) {
      if (
        role === "employee" &&
        /^\/(dashboard|employees|assignments|tests|results|settings|programs)(\/|\?|$)/.test(
          item.href,
        )
      )
        return "/my-learning";
      return item.href;
    }
    return role === "hr" ? "/dashboard" : "/my-learning";
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <SaqSidebar role={role} notificationsCount={notificationsCount} />
      <header className="topbar">
        <div className="topbar-title">
          <span className="topbar-context">Кадры · Обучение</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="topbar-actions">
          <span className="demo-label">Макет</span>
          <label className="role-switcher">
            <span className="sr-only">Режим просмотра</span>
            <select
              value={role}
              onChange={(event) => {
                const next = event.target.value as HrRole;
                onRoleChange(next);
                navigate(next === "hr" ? "/dashboard" : "/my-learning");
              }}
            >
              <option value="hr">Кадровая служба</option>
              <option value="employee">Сотрудник</option>
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          {role === "employee" && employees.length > 0 && onEmployeeChange && (
            <label className="role-switcher employee-switcher">
              <span className="sr-only">Сотрудник для просмотра</span>
              <select
                value={employeeId}
                onChange={(event) => onEmployeeChange(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </label>
          )}
          <div className="notification-root" ref={notificationsRoot}>
            <button
              type="button"
              className="notification-button icon-button"
              aria-expanded={notificationsOpen}
              aria-controls="notifications-preview"
              onClick={() => setNotificationsOpen((current) => !current)}
              aria-label={`Уведомления${notificationsCount ? `, непрочитанных: ${notificationsCount}` : ""}`}
            >
              <Bell size={19} />
              {notificationsCount > 0 && (
                <b>{notificationsCount > 99 ? "99+" : notificationsCount}</b>
              )}
            </button>
            {notificationsOpen && (
              <section
                className="notifications-preview"
                id="notifications-preview"
                aria-label="Последние уведомления"
              >
                <header>
                  <strong>Уведомления</strong>
                  {notificationsCount > 0 && (
                    <span>{notificationsCount} новых</span>
                  )}
                </header>
                {recentNotifications.length ? (
                  <div>
                    {recentNotifications.map((item) => (
                      <Link
                        key={item.id}
                        to={notificationPath(item)}
                        className={`notification-preview-item ${item.read ? "" : "unread"}`}
                        onClick={() => {
                          onNotificationRead?.(item.id);
                          setNotificationsOpen(false);
                        }}
                      >
                        <strong>{item.title}</strong>
                        <p>{item.message}</p>
                        <time dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="notifications-preview-empty">
                    Новых событий пока нет
                  </p>
                )}
                <Link
                  className="notifications-preview-all"
                  to="/notifications"
                  onClick={() => setNotificationsOpen(false)}
                >
                  Посмотреть все уведомления <ArrowRight size={15} />
                </Link>
              </section>
            )}
          </div>
          <div className="user-menu">
            <span>
              <strong>{employeeName}</strong>
              <small>{role === "hr" ? "Кадровая служба" : "Сотрудник"}</small>
            </span>
            <b className="user-avatar" aria-hidden="true">
              {initials || "SA"}
            </b>
          </div>
        </div>
      </header>
      <main id="main-content" className="content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
