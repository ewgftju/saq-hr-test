import { useEffect, useState } from "react";
import {
  Download,
  FileText,
  Play,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Headphones,
} from "lucide-react";
import { Button, Badge } from "../../../components/ui";
import type {
  AssignmentProgress,
  Certificate,
  Lesson,
} from "../../../api/types";
import { downloadFile, getFile } from "../../../api/storage";

export const entityLabels = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "В архиве",
};
export const statusLabels: Record<AssignmentProgress["status"], string> = {
  not_started: "Не начат",
  in_progress: "В процессе",
  pending_review: "На проверке",
  completed: "Завершён",
  failed: "Тест не сдан",
  overdue: "Просрочен",
};
export const statusTones: Record<
  AssignmentProgress["status"],
  "gray" | "blue" | "amber" | "green" | "red"
> = {
  not_started: "gray",
  in_progress: "blue",
  pending_review: "amber",
  completed: "green",
  failed: "red",
  overdue: "red",
};
export const lessonLabels: Record<Lesson["type"], string> = {
  text: "Текст",
  video: "Видео",
  audio: "Аудио",
  file: "Файл",
  link: "Ссылка",
};
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export const dateLabel = (value?: string) =>
  value
    ? new Date(
        value.length === 10 ? value + "T12:00:00" : value,
      ).toLocaleDateString("ru-RU")
    : "—";
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось сохранить изменения";
export const safeUrl = (url?: string) => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
};

export function LearningBadge({ progress }: { progress: AssignmentProgress }) {
  return (
    <Badge tone={statusTones[progress.status]}>
      {statusLabels[progress.status]}
    </Badge>
  );
}

export function LessonIcon({
  type,
  size = 18,
}: {
  type: Lesson["type"];
  size?: number;
}) {
  if (type === "video") return <Play size={size} />;
  if (type === "audio") return <Headphones size={size} />;
  if (type === "file") return <FileText size={size} />;
  if (type === "link") return <ExternalLink size={size} />;
  return <BookOpen size={size} />;
}

export function MaterialReader({ lesson }: { lesson: Lesson }) {
  const [objectUrl, setObjectUrl] = useState<string>();
  const [mime, setMime] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let blobUrl = "";
    setObjectUrl(undefined);
    setError("");
    setMime("");
    if (lesson.fileId)
      getFile(lesson.fileId)
        .then((blob) => {
          if (!active) return;
          if (!blob) {
            setError(
              "Файл не найден в этом браузере. Попросите кадровую службу загрузить его повторно.",
            );
            return;
          }
          blobUrl = URL.createObjectURL(blob);
          setObjectUrl(blobUrl);
          setMime(blob.type);
        })
        .catch((error) => {
          if (active) setError(errorText(error));
        });
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [lesson.id, lesson.fileId]);
  const url = safeUrl(lesson.url);
  const videoUrl =
    lesson.type === "video" &&
    (objectUrl ||
      (url && /\.(mp4|webm|ogg)(\?|$)/i.test(url) ? url : undefined));
  return (
    <div className="lesson-reader">
      <div className="section-heading">
        <Badge tone="blue">{lessonLabels[lesson.type]}</Badge>
        <span className="muted">{lesson.durationMinutes} мин.</span>
      </div>
      <h2>{lesson.title}</h2>
      {lesson.content && (
        <div
          className="lesson-text"
          style={{ whiteSpace: "pre-wrap", lineHeight: 1.85 }}
        >
          {lesson.content}
        </div>
      )}
      {videoUrl && (
        <video
          controls
          src={videoUrl}
          style={{
            width: "100%",
            maxHeight: 480,
            marginTop: 20,
            background: "#111",
            borderRadius: 10,
          }}
        />
      )}
      {objectUrl && mime === "application/pdf" && (
        <iframe
          title={lesson.fileName || "Учебный материал PDF"}
          src={objectUrl}
          style={{
            width: "100%",
            height: 540,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            marginTop: 20,
          }}
        />
      )}
      {objectUrl && mime.startsWith("audio/") && (
        <audio
          controls
          src={objectUrl}
          style={{ width: "100%", marginTop: 20 }}
        />
      )}
      {!objectUrl && lesson.type === "audio" && url && (
        <audio controls src={url} style={{ width: "100%", marginTop: 20 }} />
      )}
      {objectUrl && mime.startsWith("image/") && (
        <img
          alt={lesson.fileName || lesson.title}
          src={objectUrl}
          style={{ maxWidth: "100%", maxHeight: 520, marginTop: 20 }}
        />
      )}
      <div className="actions" style={{ marginTop: 20 }}>
        {lesson.fileId && (
          <Button
            variant="outline"
            onClick={() =>
              downloadFile(
                lesson.fileId!,
                lesson.fileName || lesson.title,
              ).catch((e) => setError(errorText(e)))
            }
          >
            <Download size={16} /> Скачать материал
          </Button>
        )}
        {url && (
          <a
            className="btn btn-outline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            {lesson.type === "video" ? "Открыть видео" : "Открыть источник"}
          </a>
        )}
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export function printCertificate(
  certificate: Certificate,
  organizationName: string,
) {
  const win = window.open("", "_blank", "width=1080,height=780");
  if (!win)
    throw new Error("Разрешите всплывающее окно для печати сертификата.");
  const escape = (value: string | number) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char]!,
    );
  win.document.write(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Сертификат ${escape(certificate.id)}</title><style>body{font-family:Arial,sans-serif;color:#142b45;background:#f3f5f8;margin:0;padding:40px}.certificate{background:white;border:2px solid #214f87;max-width:900px;margin:auto;padding:56px;text-align:center}.brand{font-size:28px;font-weight:bold;color:#214f87;letter-spacing:6px}h1{font-size:35px;letter-spacing:4px;margin-top:46px}h2{font-size:27px;margin:28px 0}.course{font-size:23px;line-height:1.5}.muted{color:#607085;line-height:1.6}.facts{margin-top:40px;display:flex;justify-content:space-between;text-align:left;font-size:14px}.button{display:block;margin:20px auto;padding:12px 20px;border:0;background:#214f87;color:white;border-radius:6px;cursor:pointer}.note{font-size:12px;margin-top:30px}@media print{body{background:white;padding:0}.certificate{border:2px solid #214f87}.button{display:none}@page{size:A4 landscape;margin:18mm}}</style></head><body><main class="certificate"><div class="brand">SAQ</div><p class="muted">${escape(organizationName)}</p><h1>СЕРТИФИКАТ</h1><p class="muted">о прохождении обучения</p><h2>${escape(certificate.employeeName)}</h2><p class="muted">успешно завершил(а) курс</p><div class="course">«${escape(certificate.courseTitle)}»</div><div class="facts"><div>Номер: ${escape(certificate.id)}<br>Дата: ${escape(dateLabel(certificate.completedAt))}</div><div>Объём: ${escape(certificate.durationHours)} ч.<br>Результат: ${certificate.score === null ? "Материалы изучены" : escape(certificate.score) + "%"}</div></div><p class="muted note">Учебный сертификат демонстрационного модуля SAQ. Не является документом государственного образца.</p></main><button class="button" onclick="window.print()">Распечатать / сохранить PDF</button></body></html>`,
  );
  win.document.close();
}

export function CompletionNotice({
  showCertificate = true,
}: {
  showCertificate?: boolean;
}) {
  return (
    <div className="alert success">
      <CheckCircle2 size={20} />
      <span>
        Обучение завершено.
        {showCertificate
          ? " Сертификат доступен для печати и сохранения в PDF."
          : ""}
      </span>
    </div>
  );
}
