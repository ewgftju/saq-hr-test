import type { AssignmentStatus } from "../../../api/types";
import { Badge } from "../../../components/ui";
import type { Tone } from "../../../components/ui";

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  not_started: "Не начат",
  in_progress: "В процессе",
  pending_review: "На проверке",
  completed: "Завершён",
  failed: "Тест не сдан",
  overdue: "Просрочен",
};

const STATUS_TONES: Record<AssignmentStatus, Tone> = {
  not_started: "gray",
  in_progress: "blue",
  pending_review: "amber",
  completed: "green",
  failed: "red",
  overdue: "red",
};

export function HrStatus({
  status,
  cancelled = false,
}: {
  status: AssignmentStatus;
  cancelled?: boolean;
}) {
  return (
    <Badge tone={cancelled ? "gray" : STATUS_TONES[status]}>
      {cancelled ? "Отменён" : STATUS_LABELS[status]}
    </Badge>
  );
}

export function hrDate(value?: string, withTime = false) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime
      ? ({
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Qyzylorda",
        } as const)
      : {}),
  }).format(date);
}

export function hrToday() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Qyzylorda",
  }).format(new Date());
}

export function HrAvatar({ name, color }: { name: string; color?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <span
      className="hr-avatar"
      style={color ? { background: color } : undefined}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** Export UTF-8 CSV understood by Excel; neutralize spreadsheet formula injection. */
export function exportHrCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    [
      "\uFEFF" +
        [headers, ...rows].map((row) => row.map(escape).join(";")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HrFeedback({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return message ? (
    <div
      className={`hr-feedback ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {message}
    </div>
  ) : null;
}
