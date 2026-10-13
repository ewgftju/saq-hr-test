import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Eye,
  Pencil,
  Plus,
  Save,
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
import { saveFile } from "../../../api/storage";
import type { Course, Lesson } from "../../../api/types";
import {
  errorText,
  lessonLabels,
  LessonIcon,
  MaterialReader,
  newId,
  safeUrl,
} from "./CourseShared";

const blankLesson = (): Lesson => ({
  id: newId("lesson"),
  title: "",
  type: "text",
  content: "",
  durationMinutes: 10,
});
const blankCourse = (): Course => ({
  id: newId("course"),
  title: "",
  description: "",
  category: "Повышение квалификации",
  durationHours: 1,
  status: "draft",
  chapters: [],
  updatedAt: new Date().toISOString(),
  coverColor: "#edf3fc",
  instructor: "",
  tags: [],
  allowSelfEnrollment: true,
  certificateEnabled: true,
});

export default function CourseEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, role, saveCourse, archiveCourse } = useHr();
  const [course, setCourse] = useState<Course>(() =>
    structuredClone(
      state.courses.find((item) => item.id === id) || blankCourse(),
    ),
  );
  const [error, setError] = useState("");
  const [lessonDraft, setLessonDraft] = useState<Lesson | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Lesson | null>(null);
  const [lessonError, setLessonError] = useState("");
  useEffect(() => {
    setCourse(
      structuredClone(
        state.courses.find((item) => item.id === id) || blankCourse(),
      ),
    );
    setError("");
  }, [id]);
  if (role !== "hr")
    return (
      <EmptyState
        title="Редактирование доступно кадровой службе"
        description="Откройте каталог курсов для обучения."
      />
    );
  if (id && !state.courses.some((item) => item.id === id))
    return (
      <EmptyState
        title="Курс не найден"
        description="Вернитесь в каталог и выберите существующий курс."
      />
    );
  const update = <K extends keyof Course>(key: K, value: Course[K]) =>
    setCourse((current) => ({ ...current, [key]: value }));
  const save = (status: Course["status"]) => {
    setError("");
    try {
      const savedId = saveCourse({
        ...course,
        status,
        updatedAt: new Date().toISOString(),
      });
      navigate(`/courses/${savedId}`);
    } catch (error) {
      setError(errorText(error));
    }
  };
  const reorderChapter = (index: number, shift: number) => {
    const chapters = [...course.chapters];
    [chapters[index], chapters[index + shift]] = [
      chapters[index + shift],
      chapters[index],
    ];
    update("chapters", chapters);
  };
  const reorderLesson = (parent: string, index: number, shift: number) =>
    update(
      "chapters",
      course.chapters.map((chapter) => {
        if (chapter.id !== parent) return chapter;
        const lessons = [...chapter.lessons];
        [lessons[index], lessons[index + shift]] = [
          lessons[index + shift],
          lessons[index],
        ];
        return { ...chapter, lessons };
      }),
    );
  const openLesson = (parent: string, lesson?: Lesson) => {
    setChapterId(parent);
    setLessonDraft(structuredClone(lesson || blankLesson()));
    setFile(null);
    setLessonError("");
  };
  const saveLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!lessonDraft) return;
    setLessonError("");
    if (!lessonDraft.title.trim()) {
      setLessonError("Укажите название материала.");
      return;
    }
    if (lessonDraft.type === "text" && !lessonDraft.content.trim()) {
      setLessonError("Добавьте текст учебного материала.");
      return;
    }
    if (
      ["link", "video", "audio"].includes(lessonDraft.type) &&
      !file &&
      !lessonDraft.fileId &&
      !safeUrl(lessonDraft.url)
    ) {
      setLessonError(
        "Укажите корректную ссылку http/https или загрузите файл.",
      );
      return;
    }
    if (lessonDraft.type === "file" && !file && !lessonDraft.fileId) {
      setLessonError("Выберите файл материала.");
      return;
    }
    setUploading(true);
    try {
      const next = { ...lessonDraft, title: lessonDraft.title.trim() };
      if (file) {
        next.fileId = await saveFile(file, file.name);
        next.fileName = file.name;
      }
      update(
        "chapters",
        course.chapters.map((chapter) =>
          chapter.id !== chapterId
            ? chapter
            : {
                ...chapter,
                lessons: chapter.lessons.some((lesson) => lesson.id === next.id)
                  ? chapter.lessons.map((lesson) =>
                      lesson.id === next.id ? next : lesson,
                    )
                  : [...chapter.lessons, next],
              },
        ),
      );
      setLessonDraft(null);
    } catch (error) {
      setLessonError(errorText(error));
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <Link to={id ? `/courses/${id}` : "/courses"} className="back-link">
        <ArrowLeft size={16} /> {id ? "К курсу" : "Каталог курсов"}
      </Link>
      <PageHeading
        title={id ? "Редактирование курса" : "Новый курс"}
        subtitle="Подготовьте материалы, выберите итоговый тест и опубликуйте курс"
        action={
          <div className="actions">
            <Button variant="outline" onClick={() => save("draft")}>
              <Save size={17} /> Сохранить черновик
            </Button>
            <Button onClick={() => save("published")}>Опубликовать</Button>
          </div>
        }
      />
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <section className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <h2>Основная информация</h2>
        <div className="form-grid">
          <Field label="Название курса *">
            <input
              value={course.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Например, Планирование государственного аудита"
              maxLength={180}
            />
          </Field>
          <Field label="Направление *">
            <input
              list="course-categories"
              value={course.category}
              onChange={(event) => update("category", event.target.value)}
            />
            <datalist id="course-categories">
              <option>Повышение квалификации</option>
              <option>Подготовка кандидатов</option>
              <option>Адаптация сотрудников</option>
              <option>Работа в SAQ</option>
            </datalist>
          </Field>
          <Field label="Продолжительность, часов *">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={course.durationHours}
              onChange={(event) =>
                update("durationHours", Number(event.target.value))
              }
            />
          </Field>
          <Field label="Преподаватель / автор">
            <input
              value={course.instructor || ""}
              onChange={(event) => update("instructor", event.target.value)}
              placeholder="ФИО или подразделение"
            />
          </Field>
          <Field label="Ключевые слова" hint="Разделяйте запятыми">
            <input
              value={(course.tags || []).join(", ")}
              onChange={(event) =>
                update(
                  "tags",
                  event.target.value.split(",").map((tag) => tag.trimStart()),
                )
              }
              placeholder="аудит, риски, планирование"
            />
          </Field>
          <Field label="Цвет карточки">
            <select
              value={course.coverColor}
              onChange={(event) => update("coverColor", event.target.value)}
            >
              <option value="#edf3fc">Голубой</option>
              <option value="#edf7f1">Зелёный</option>
              <option value="#f3eefb">Сиреневый</option>
              <option value="#fff5e5">Песочный</option>
              <option value="#f0f3f7">Серый</option>
            </select>
          </Field>
        </div>
        <Field label="Описание и результаты обучения *">
          <textarea
            rows={4}
            value={course.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Какие знания получит сотрудник и кому предназначен этот курс"
          />
        </Field>
        <div className="actions" style={{ marginTop: 18, gap: 28 }}>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={course.allowSelfEnrollment !== false}
              onChange={(event) =>
                update("allowSelfEnrollment", event.target.checked)
              }
            />{" "}
            Разрешить самостоятельную запись
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={course.certificateEnabled !== false}
              onChange={(event) =>
                update("certificateEnabled", event.target.checked)
              }
            />{" "}
            Выдавать сертификат после завершения
          </label>
        </div>
      </section>
      <section className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div className="section-heading">
          <div>
            <h2>Программа курса</h2>
            <p className="muted">
              Главы и учебные материалы в порядке прохождения
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              update("chapters", [
                ...course.chapters,
                {
                  id: newId("chapter"),
                  title: `Глава ${course.chapters.length + 1}`,
                  lessons: [],
                },
              ])
            }
          >
            <Plus size={17} /> Добавить главу
          </Button>
        </div>
        {!course.chapters.length && (
          <EmptyState
            title="Добавьте первую главу"
            description="В главе могут быть тексты, видео, аудио, документы и ссылки."
          />
        )}
        {course.chapters.map((chapter, chapterIndex) => (
          <div
            key={chapter.id}
            className="chapter-editor"
            style={{
              border: "1px solid #e0e6ee",
              borderRadius: 10,
              marginTop: 16,
            }}
          >
            <div
              className="section-heading"
              style={{
                padding: 16,
                background: "#f8fafc",
                borderRadius: "10px 10px 0 0",
              }}
            >
              <div className="actions" style={{ flex: 1 }}>
                <Badge tone="gray">{chapterIndex + 1}</Badge>
                <input
                  aria-label={`Название главы ${chapterIndex + 1}`}
                  value={chapter.title}
                  onChange={(event) =>
                    update(
                      "chapters",
                      course.chapters.map((item) =>
                        item.id === chapter.id
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="actions">
                <Button
                  variant="ghost"
                  aria-label="Поднять главу"
                  disabled={chapterIndex === 0}
                  onClick={() => reorderChapter(chapterIndex, -1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Опустить главу"
                  disabled={chapterIndex === course.chapters.length - 1}
                  onClick={() => reorderChapter(chapterIndex, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Удалить главу"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Удалить главу «${chapter.title}» вместе с материалами?`,
                      )
                    )
                      update(
                        "chapters",
                        course.chapters.filter(
                          (item) => item.id !== chapter.id,
                        ),
                      );
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
            {chapter.lessons.map((lesson, lessonIndex) => (
              <div
                key={lesson.id}
                className="lesson-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 18px",
                  borderTop: "1px solid #edf0f4",
                }}
              >
                <LessonIcon type={lesson.type} />
                <div style={{ flex: 1 }}>
                  <strong>{lesson.title}</strong>
                  <div className="muted small">
                    {lessonLabels[lesson.type]} · {lesson.durationMinutes} мин.
                  </div>
                </div>
                <div className="actions">
                  <Button
                    variant="ghost"
                    aria-label={`Просмотреть ${lesson.title}`}
                    onClick={() => setPreview(lesson)}
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Изменить ${lesson.title}`}
                    onClick={() => openLesson(chapter.id, lesson)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label="Поднять материал"
                    disabled={lessonIndex === 0}
                    onClick={() => reorderLesson(chapter.id, lessonIndex, -1)}
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label="Опустить материал"
                    disabled={lessonIndex === chapter.lessons.length - 1}
                    onClick={() => reorderLesson(chapter.id, lessonIndex, 1)}
                  >
                    <ArrowDown size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Удалить ${lesson.title}`}
                    onClick={() => {
                      if (window.confirm(`Удалить материал «${lesson.title}»?`))
                        update(
                          "chapters",
                          course.chapters.map((item) =>
                            item.id === chapter.id
                              ? {
                                  ...item,
                                  lessons: item.lessons.filter(
                                    (value) => value.id !== lesson.id,
                                  ),
                                }
                              : item,
                          ),
                        );
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
            <div style={{ padding: 16 }}>
              <Button variant="outline" onClick={() => openLesson(chapter.id)}>
                <Plus size={16} /> Добавить материал
              </Button>
            </div>
          </div>
        ))}
      </section>
      <section className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <h2>Итоговое тестирование</h2>
        <Field
          label="Тест курса"
          hint="Тест открывается сотруднику после изучения всех материалов. Для завершения курса нужно набрать проходной балл."
        >
          <select
            value={course.testId || ""}
            onChange={(event) =>
              update("testId", event.target.value || undefined)
            }
          >
            <option value="">Без итогового теста</option>
            {state.tests
              .filter((test) => test.status !== "archived")
              .map((test) => (
                <option value={test.id} key={test.id}>
                  {test.title}
                  {test.status === "draft" ? " — черновик" : ""}
                </option>
              ))}
          </select>
        </Field>
        <Link
          className="text-link"
          to="/tests"
          style={{ display: "inline-block", marginTop: 14 }}
        >
          Открыть банк тестов
        </Link>
      </section>
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <div>
          {id && course.status !== "archived" && (
            <Button
              variant="danger"
              onClick={() => {
                if (
                  window.confirm(
                    "Переместить курс в архив? Новые записи на него будут закрыты.",
                  )
                ) {
                  try {
                    archiveCourse(id);
                    navigate("/courses");
                  } catch (error) {
                    setError(errorText(error));
                  }
                }
              }}
            >
              В архив
            </Button>
          )}
        </div>
        <div className="actions">
          <Button variant="outline" onClick={() => save("draft")}>
            <Save size={16} /> Сохранить черновик
          </Button>
          <Button onClick={() => save("published")}>Опубликовать курс</Button>
        </div>
      </div>
      <Modal
        open={!!lessonDraft}
        title="Учебный материал"
        onClose={() => !uploading && setLessonDraft(null)}
        wide
        footer={
          <>
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => setLessonDraft(null)}
            >
              Отмена
            </Button>
            <Button type="submit" form="lesson-form" disabled={uploading}>
              {uploading ? "Загрузка…" : "Сохранить материал"}
            </Button>
          </>
        }
      >
        {lessonDraft && (
          <form id="lesson-form" onSubmit={saveLesson}>
            {lessonError && (
              <div className="alert error" role="alert">
                {lessonError}
              </div>
            )}
            <Field label="Название *">
              <input
                required
                value={lessonDraft.title}
                onChange={(event) =>
                  setLessonDraft({ ...lessonDraft, title: event.target.value })
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="Тип материала">
                <select
                  value={lessonDraft.type}
                  onChange={(event) => {
                    setLessonDraft({
                      ...lessonDraft,
                      type: event.target.value as Lesson["type"],
                      fileId: undefined,
                      fileName: undefined,
                      url: undefined,
                    });
                    setFile(null);
                  }}
                >
                  <option value="text">Текст</option>
                  <option value="video">Видео</option>
                  <option value="audio">Аудио</option>
                  <option value="file">Документ / файл</option>
                  <option value="link">Внешняя ссылка</option>
                </select>
              </Field>
              <Field label="Время изучения, минут">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={lessonDraft.durationMinutes}
                  onChange={(event) =>
                    setLessonDraft({
                      ...lessonDraft,
                      durationMinutes: Number(event.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <Field
              label={
                lessonDraft.type === "text"
                  ? "Текст материала *"
                  : "Описание / инструкция"
              }
            >
              <textarea
                rows={lessonDraft.type === "text" ? 10 : 4}
                required={lessonDraft.type === "text"}
                value={lessonDraft.content}
                onChange={(event) =>
                  setLessonDraft({
                    ...lessonDraft,
                    content: event.target.value,
                  })
                }
              />
            </Field>
            {["link", "video", "audio"].includes(lessonDraft.type) && (
              <Field label="Ссылка http/https">
                <input
                  type="url"
                  placeholder="https://…"
                  value={lessonDraft.url || ""}
                  onChange={(event) =>
                    setLessonDraft({ ...lessonDraft, url: event.target.value })
                  }
                />
              </Field>
            )}
            {["file", "video", "audio"].includes(lessonDraft.type) && (
              <Field
                label={
                  lessonDraft.type === "file"
                    ? "Загрузить файл *"
                    : "Или загрузить файл"
                }
                hint={
                  lessonDraft.fileName
                    ? `Текущий файл: ${lessonDraft.fileName}`
                    : "Файл будет доступен для просмотра и скачивания."
                }
              >
                <div className="upload-area">
                  <Upload size={22} />
                  <input
                    type="file"
                    accept={
                      lessonDraft.type === "video"
                        ? "video/*"
                        : lessonDraft.type === "audio"
                          ? "audio/*"
                          : undefined
                    }
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (selected && selected.size > 50 * 1024 * 1024) {
                        setLessonError(
                          "Размер файла не должен превышать 50 МБ.",
                        );
                        event.target.value = "";
                        return;
                      }
                      setFile(selected || null);
                      setLessonError("");
                    }}
                  />
                </div>
                {file && (
                  <span className="muted">
                    {file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ
                  </span>
                )}
              </Field>
            )}
          </form>
        )}
      </Modal>
      <Modal
        open={!!preview}
        title="Предпросмотр материала"
        onClose={() => setPreview(null)}
        wide
      >
        {preview && <MaterialReader lesson={preview} />}
      </Modal>
    </>
  );
}
