import { useState } from "react";
import { Link } from "react-router-dom";
import { Award, Bell, BookOpen, CalendarClock, CheckCheck } from "lucide-react";
import { useHr } from "../../../store/HrContext";
import { Button, EmptyState, PageHeading } from "../../../components/ui";
import type { Notification } from "../../../api/types";
import { hrDate } from "./HrManagementShared";
import "./HrManagement.css";

const icons = {
  assignment: BookOpen,
  deadline: CalendarClock,
  result: Award,
  system: Bell,
};

export default function NotificationsPage() {
  const {
    state,
    role,
    employeeId,
    markNotificationRead,
    markAllNotificationsRead,
  } = useHr();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [kind, setKind] = useState("all");
  const scoped = state.notifications.filter((notification) => {
    if (
      role === "hr" &&
      notification.audience !== "hr" &&
      notification.audience !== "all"
    )
      return false;
    if (role === "employee" && notification.audience === "hr") return false;
    if (
      role === "employee" &&
      notification.employeeId &&
      notification.employeeId !== employeeId
    )
      return false;
    return true;
  });
  const unread = scoped.filter((notification) => !notification.read).length;
  const visible = scoped
    .filter(
      (notification) =>
        (tab !== "unread" || !notification.read) &&
        (kind === "all" || notification.type === kind),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const destination = (notification: Notification) => {
    const raw = notification.href;
    // Notification links remain inside this module.
    if (raw?.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
      if (
        role === "employee" &&
        /^\/(dashboard|employees|assignments|tests|results|settings)(\/|\?|$)/.test(
          raw,
        )
      )
        return "/my-learning";
      return raw;
    }
    return role === "employee"
      ? "/my-learning"
      : notification.type === "result"
        ? "/results"
        : "/assignments";
  };
  return (
    <div className="page">
      <PageHeading
        title="Уведомления"
        subtitle={
          unread
            ? `Непрочитанных уведомлений: ${unread}`
            : "Все события по обучению в одном месте"
        }
        action={
          <Button
            variant="outline"
            disabled={!unread}
            onClick={markAllNotificationsRead}
          >
            <CheckCheck size={16} />
            Прочитать все
          </Button>
        }
      />
      <div className="hr-split-heading">
        <div
          className="hr-notification-tabs"
          role="tablist"
          aria-label="Уведомления"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={tab === "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            Все · {scoped.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "unread"}
            className={tab === "unread" ? "active" : ""}
            onClick={() => setTab("unread")}
          >
            Непрочитанные · {unread}
          </button>
        </div>
        <label>
          <span className="sr-only">Тип уведомления</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="all">Все события</option>
            <option value="assignment">Назначения</option>
            <option value="deadline">Сроки</option>
            <option value="result">Результаты</option>
            <option value="system">Системные</option>
          </select>
        </label>
      </div>
      <section className="panel">
        {visible.length ? (
          visible.map((notification) => {
            const Icon = icons[notification.type];
            const person =
              role === "hr"
                ? state.employees.find(
                    (employee) => employee.id === notification.employeeId,
                  )
                : undefined;
            return (
              <article
                key={notification.id}
                className={`hr-notification-row ${notification.read ? "" : "unread"}`}
              >
                <span
                  className={`hr-notification-symbol ${notification.type}`}
                  aria-hidden="true"
                >
                  <Icon size={18} />
                </span>
                <div>
                  <h3>
                    {notification.title}
                    {!notification.read && (
                      <span
                        className="hr-unread-dot"
                        aria-label="Не прочитано"
                      />
                    )}
                  </h3>
                  <p>{notification.message}</p>
                  {person && (
                    <span className="hr-subtext">
                      {person.name} · {person.department}
                    </span>
                  )}
                  <div className="hr-notification-actions">
                    <time dateTime={notification.createdAt}>
                      {hrDate(notification.createdAt, true)}
                    </time>
                    <Link
                      to={destination(notification)}
                      onClick={() => markNotificationRead(notification.id)}
                    >
                      Открыть →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState
            title={
              tab === "unread"
                ? "Нет непрочитанных уведомлений"
                : "Уведомлений пока нет"
            }
            description={
              kind !== "all"
                ? "Попробуйте выбрать другой тип события."
                : "Здесь появятся назначения, напоминания о сроках и результаты обучения."
            }
            icon={<Bell size={28} />}
          />
        )}
      </section>
    </div>
  );
}
