import { useState, type FormEvent } from "react";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Headphones,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeading,
} from "../../../components/ui";
import { useHr } from "../../../store/HrContext";
import { downloadFile, saveFile } from "../../../api/storage";
import type { Resource } from "../../../api/types";
import {
  dateLabel,
  errorText,
  MaterialReader,
  newId,
  safeUrl,
} from "./CourseShared";

const categories = [
  "Методические материалы",
  "Нормативные правовые акты",
  "Аудиоматериалы",
  "Аналитические материалы",
  "Художественная литература",
];
const blankResource = (): Resource => ({
  id: newId("resource"),
  title: "",
  description: "",
  category: categories[0],
  type: "file",
  updatedAt: new Date().toISOString(),
});

export default function LibraryPage() {
  const { state, role, saveResource, deleteResource } = useHr();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<Resource | null>(null);
  const [preview, setPreview] = useState<Resource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const allCategories = [
    ...new Set([
      ...categories,
      ...state.resources.map((resource) => resource.category),
    ]),
  ];
  const resources = state.resources.filter(
    (resource) =>
      (category === "all" || resource.category === category) &&
      `${resource.title} ${resource.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setError("");
    if (draft.type === "link" && !safeUrl(draft.url)) {
      setError("Введите корректную ссылку http/https.");
      return;
    }
    if (draft.type === "file" && !file && !draft.fileId) {
      setError("Выберите файл для загрузки.");
      return;
    }
    setBusy(true);
    try {
      const next = { ...draft, updatedAt: new Date().toISOString() };
      if (file) {
        next.fileId = await saveFile(file, file.name);
        next.fileName = file.name;
      }
      saveResource(next);
      setDraft(null);
      setFile(null);
      setNotice("Материал добавлен в библиотеку.");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const openEditor = (resource?: Resource) => {
    setError("");
    setFile(null);
    setDraft(structuredClone(resource || blankResource()));
  };
  return (
    <>
      <PageHeading
        title="Библиотека"
        subtitle="Документы, нормативные источники, аудио и дополнительная литература"
        action={
          role === "hr" ? (
            <Button onClick={() => openEditor()}>
              <Plus size={18} /> Добавить материал
            </Button>
          ) : undefined
        }
      />
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      {error && !draft && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="panel toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Поиск материала"
            placeholder="Название или описание материала"
          />
        </div>
        <select
          aria-label="Категория материала"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">Все категории</option>
          {allCategories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <span className="muted">Материалов: {resources.length}</span>
      </div>
      {!resources.length ? (
        <EmptyState
          title="Материалы не найдены"
          description="Измените параметры поиска или добавьте новый материал."
        />
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Материал</th>
                <th>Категория</th>
                <th>Формат</th>
                <th>Обновлён</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <div
                      className="actions"
                      style={{ alignItems: "flex-start", flexWrap: "nowrap" }}
                    >
                      <div className="resource-icon">
                        {resource.category === "Аудиоматериалы" ? (
                          <Headphones size={22} />
                        ) : resource.category ===
                          "Художественная литература" ? (
                          <BookOpen size={22} />
                        ) : (
                          <FileText size={22} />
                        )}
                      </div>
                      <div>
                        <button
                          className="text-link"
                          style={{
                            border: 0,
                            padding: 0,
                            background: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            font: "inherit",
                            fontWeight: 600,
                          }}
                          onClick={() => setPreview(resource)}
                        >
                          {resource.title}
                        </button>
                        <p
                          className="muted small"
                          style={{ margin: "6px 0 0", maxWidth: 540 }}
                        >
                          {resource.description}
                        </p>
                        {resource.fileName && (
                          <span className="muted small">
                            {resource.fileName}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{resource.category}</td>
                  <td>
                    <Badge tone="gray">
                      {resource.type === "link"
                        ? "Ссылка"
                        : resource.fileName?.split(".").at(-1)?.toUpperCase() ||
                          "Файл"}
                    </Badge>
                  </td>
                  <td>{dateLabel(resource.updatedAt)}</td>
                  <td>
                    <div className="actions">
                      {resource.type === "file" && resource.fileId ? (
                        <Button
                          variant="ghost"
                          aria-label={`Скачать ${resource.title}`}
                          title="Скачать"
                          onClick={() =>
                            downloadFile(
                              resource.fileId!,
                              resource.fileName || resource.title,
                            ).catch((error) => setError(errorText(error)))
                          }
                        >
                          <Download size={17} />
                        </Button>
                      ) : (
                        safeUrl(resource.url) && (
                          <a
                            className="btn btn-ghost"
                            href={safeUrl(resource.url)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Открыть ${resource.title}`}
                            title="Открыть источник"
                          >
                            <ExternalLink size={17} />
                          </a>
                        )
                      )}
                      {role === "hr" && (
                        <>
                          <Button
                            variant="ghost"
                            aria-label={`Изменить ${resource.title}`}
                            title="Изменить"
                            onClick={() => openEditor(resource)}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Удалить ${resource.title}`}
                            title="Удалить"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Удалить материал «${resource.title}» из библиотеки?`,
                                )
                              ) {
                                try {
                                  deleteResource(resource.id);
                                  setNotice("Материал удалён из библиотеки.");
                                } catch (error) {
                                  setError(errorText(error));
                                }
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={!!draft}
        title={
          draft && state.resources.some((resource) => resource.id === draft.id)
            ? "Редактировать материал"
            : "Новый материал"
        }
        wide
        onClose={() => !busy && setDraft(null)}
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Отмена
            </Button>
            <Button type="submit" form="resource-editor" disabled={busy}>
              {busy ? "Загрузка…" : "Сохранить материал"}
            </Button>
          </>
        }
      >
        {draft && (
          <form id="resource-editor" onSubmit={save}>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <Field label="Название *">
              <input
                required
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="Категория">
                <select
                  value={draft.category}
                  onChange={(event) =>
                    setDraft({ ...draft, category: event.target.value })
                  }
                >
                  {allCategories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Источник">
                <select
                  value={draft.type}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      type: event.target.value as Resource["type"],
                      url: undefined,
                      fileId: undefined,
                      fileName: undefined,
                    });
                    setFile(null);
                  }}
                >
                  <option value="file">Загрузить файл</option>
                  <option value="link">Внешняя ссылка</option>
                </select>
              </Field>
            </div>
            <Field label="Описание">
              <textarea
                rows={4}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </Field>
            {draft.type === "link" ? (
              <Field label="Ссылка *">
                <input
                  type="url"
                  required
                  placeholder="https://…"
                  value={draft.url || ""}
                  onChange={(event) =>
                    setDraft({ ...draft, url: event.target.value })
                  }
                />
              </Field>
            ) : (
              <Field
                label="Файл *"
                hint={
                  draft.fileName
                    ? `Текущий файл: ${draft.fileName}`
                    : "PDF, документы, изображения, аудиозаписи и другие материалы, до 50 МБ."
                }
              >
                <div className="upload-area">
                  <Upload size={22} />
                  <input
                    type="file"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (selected && selected.size > 50 * 1024 * 1024) {
                        setError("Размер файла не должен превышать 50 МБ.");
                        event.target.value = "";
                        return;
                      }
                      setFile(selected || null);
                      setError("");
                    }}
                  />
                </div>
                {file && (
                  <p className="muted">
                    {file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ
                  </p>
                )}
              </Field>
            )}
          </form>
        )}
      </Modal>
      <Modal
        open={!!preview}
        title="Материал библиотеки"
        wide
        onClose={() => setPreview(null)}
      >
        {preview && (
          <>
            <Badge tone="gray">{preview.category}</Badge>
            <MaterialReader
              lesson={{
                id: preview.id,
                title: preview.title,
                type:
                  preview.category === "Аудиоматериалы"
                    ? "audio"
                    : preview.type,
                content: preview.description,
                fileId: preview.fileId,
                fileName: preview.fileName,
                url: preview.url,
                durationMinutes: 0,
              }}
            />
          </>
        )}
      </Modal>
    </>
  );
}
