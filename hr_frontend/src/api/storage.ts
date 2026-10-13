import type { HrState } from "./types";

export const STATE_KEY = "saq-hr:v1";
const RECOVERY_KEY = "saq-hr:recovery";
let invalidState = false;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown) => typeof v === "string";
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const timestamp = (v: unknown) =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));
const strings = (v: unknown) => Array.isArray(v) && v.every(string);
const rows = (
  v: unknown,
  check: (v: Record<string, unknown>) => boolean,
): boolean =>
  Array.isArray(v) &&
  v.every(
    (item) => record(item) && string(item.id) && !!item.id && check(item),
  ) &&
  new Set(v.map((item) => item.id)).size === v.length;
const question = (q: Record<string, unknown>) =>
  string(q.text) &&
  ["single", "multiple", "text", "open"].includes(String(q.type)) &&
  rows(q.options, (o) => string(o.text)) &&
  strings(q.correctAnswers) &&
  finite(q.points) &&
  Number(q.points) > 0;
const test = (t: Record<string, unknown>) =>
  string(t.title) &&
  string(t.description) &&
  rows(t.questions, question) &&
  ["draft", "published", "archived"].includes(String(t.status)) &&
  finite(t.timeLimitMinutes) &&
  Number(t.timeLimitMinutes) >= 0 &&
  finite(t.passPercent) &&
  Number(t.passPercent) >= 1 &&
  Number(t.passPercent) <= 100 &&
  finite(t.maxAttempts) &&
  Number(t.maxAttempts) >= 0 &&
  [
    "shuffleQuestions",
    "shuffleAnswers",
    "allowNegativeMarking",
    "showAnswers",
    "showHistory",
  ].every((k) => typeof t[k] === "boolean") &&
  finite(t.negativePoints) &&
  finite(t.questionLimit);
/** Validate before using persisted data. Unknown or damaged schema is never silently trusted. */
export function isHrState(value: unknown): value is HrState {
  if (!record(value) || value.version !== 1 || !record(value.settings))
    return false;
  const s = value.settings;
  if (
    !string(s.organizationName) ||
    !string(s.certificatePrefix) ||
    ![
      "defaultPassPercent",
      "defaultTimeLimitMinutes",
      "defaultMaxAttempts",
      "notificationDaysBefore",
    ].every((k) => finite(s[k]))
  )
    return false;
  if (
    !rows(
      value.employees,
      (e) =>
        ["name", "email", "department", "position"].every((k) =>
          string(e[k]),
        ) && ["active", "inactive"].includes(String(e.status)),
    )
  )
    return false;
  if (
    !rows(
      value.courses,
      (c) =>
        ["title", "description", "category", "updatedAt"].every((k) =>
          string(c[k]),
        ) &&
        finite(c.durationHours) &&
        ["draft", "published", "archived"].includes(String(c.status)) &&
        rows(
          c.chapters,
          (ch) =>
            string(ch.title) &&
            rows(
              ch.lessons,
              (l) =>
                string(l.title) &&
                string(l.content) &&
                finite(l.durationMinutes) &&
                ["text", "video", "audio", "file", "link"].includes(
                  String(l.type),
                ),
            ),
        ),
    )
  )
    return false;
  if (!rows(value.tests, test)) return false;
  if (
    !rows(
      value.programs,
      (p) =>
        string(p.title) &&
        string(p.description) &&
        strings(p.courseIds) &&
        strings(p.employeeIds) &&
        string(p.deadline) &&
        ["draft", "published", "archived"].includes(String(p.status)),
    )
  )
    return false;
  if (
    !rows(
      value.assignments,
      (a) =>
        ["employeeId", "courseId", "assignedAt", "deadline"].every((k) =>
          string(a[k]),
        ) &&
        timestamp(a.assignedAt) &&
        timestamp(a.deadline) &&
        typeof a.required === "boolean" &&
        strings(a.completedLessonIds),
    )
  )
    return false;
  if (
    !rows(
      value.attempts,
      (a) =>
        [
          "employeeId",
          "testId",
          "courseId",
          "assignmentId",
          "startedAt",
          "expiresAt",
        ].every((k) => string(a[k])) &&
        timestamp(a.startedAt) &&
        (a.expiresAt === "" || timestamp(a.expiresAt)) &&
        ["in_progress", "passed", "failed", "pending_review"].includes(
          String(a.status),
        ) &&
        ["number", "score", "maxScore", "percent"].every((k) => finite(a[k])) &&
        Number(a.maxScore) > 0 &&
        rows(a.questions, question) &&
        record(a.testSnapshot) &&
        test(a.testSnapshot) &&
        record(a.answers) &&
        Object.values(a.answers).every(strings) &&
        record(a.questionScores) &&
        Object.values(a.questionScores).every(finite) &&
        record(a.reviewComments) &&
        Object.values(a.reviewComments).every(string),
    )
  )
    return false;
  if (
    !rows(
      value.notifications,
      (n) =>
        ["title", "message", "createdAt", "type"].every((k) => string(n[k])) &&
        typeof n.read === "boolean",
    )
  )
    return false;
  if (
    !rows(
      value.resources,
      (r) =>
        ["title", "description", "category", "updatedAt"].every((k) =>
          string(r[k]),
        ) && ["file", "link"].includes(String(r.type)),
    )
  )
    return false;
  if (
    !rows(
      value.reviews,
      (r) =>
        ["courseId", "employeeId", "text", "createdAt"].every((k) =>
          string(r[k]),
        ) &&
        finite(r.rating) &&
        Number(r.rating) >= 1 &&
        Number(r.rating) <= 5,
    )
  )
    return false;
  const employees = new Set(
    (value.employees as { id: string }[]).map((e) => e.id),
  );
  const courses = new Set((value.courses as { id: string }[]).map((c) => c.id));
  const assignments = new Set(
    (value.assignments as { id: string }[]).map((a) => a.id),
  );
  if (
    (value.assignments as { employeeId: string; courseId: string }[]).some(
      (a) => !employees.has(a.employeeId) || !courses.has(a.courseId),
    )
  )
    return false;
  if (
    (value.attempts as { employeeId: string; assignmentId: string }[]).some(
      (a) => !employees.has(a.employeeId) || !assignments.has(a.assignmentId),
    )
  )
    return false;
  return true;
}
export function loadState(fallback: () => HrState): {
  state: HrState;
  error: string | null;
} {
  if (typeof localStorage === "undefined")
    return { state: fallback(), error: null };
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { state: fallback(), error: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isHrState(parsed))
      throw new Error(
        "Неподдерживаемая версия или повреждённая структура данных.",
      );
    invalidState = false;
    return { state: parsed, error: null };
  } catch {
    invalidState = true;
    return {
      state: fallback(),
      error:
        "Сохранённые данные не удалось прочитать. Показан демонстрационный набор; исходные данные будут сохранены отдельно перед следующей записью.",
    };
  }
}
export function persistState(state: HrState): string | null {
  try {
    if (!isHrState(state))
      return "Изменения не сохранены: данные не прошли проверку структуры.";
    if (invalidState) {
      const original = localStorage.getItem(STATE_KEY);
      if (original) localStorage.setItem(RECOVERY_KEY, original);
      invalidState = false;
    }
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return null;
  } catch {
    return "Не удалось сохранить изменения в браузере. Проверьте свободное место и доступ к хранилищу. Изменения текущего сеанса остаются на экране.";
  }
}

const DB_NAME = "saq-hr-files";
let database: Promise<IDBDatabase> | undefined;
function openFiles(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("Хранилище файлов недоступно в этом браузере."));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("files", { keyPath: "id" });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
      req.onerror = () => {
        database = undefined;
        reject(new Error("Не удалось открыть хранилище файлов."));
      };
    });
  return database;
}
export async function saveFile(file: Blob, name = "document"): Promise<string> {
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Размер файла не должен превышать 50 МБ.");
  const db = await openFiles();
  const id = `file-${crypto.randomUUID()}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put({
      id,
      blob: file,
      name,
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(
        new Error(
          "Не удалось сохранить файл. Проверьте свободное место в браузере.",
        ),
      );
    tx.onabort = () => reject(new Error("Сохранение файла прервано."));
  });
  return id;
}
export async function getFile(id: string): Promise<Blob | undefined> {
  const db = await openFiles();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("files", "readonly")
      .objectStore("files")
      .get(id);
    req.onsuccess = () => resolve(req.result?.blob);
    req.onerror = () => reject(new Error("Не удалось прочитать файл."));
  });
}
export async function deleteFile(id: string): Promise<void> {
  const db = await openFiles();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("Не удалось удалить файл."));
  });
}
export async function downloadFile(
  id: string,
  fileName: string,
): Promise<void> {
  const file = await getFile(id);
  if (!file)
    throw new Error("Файл не найден в этом браузере. Загрузите его повторно.");
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
