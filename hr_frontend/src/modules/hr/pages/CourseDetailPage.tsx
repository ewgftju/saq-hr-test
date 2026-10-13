import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LockKeyhole,
  Pencil,
  Play,
  Plus,
  Star,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  Progress,
} from "../../../components/ui";
import { useHr } from "../../../store/HrContext";
import {
  getAssignmentProgress,
  getCertificate,
  getCourseLessons,
} from "../../../utils/domain";
import {
  CompletionNotice,
  dateLabel,
  entityLabels,
  errorText,
  LearningBadge,
  LessonIcon,
  MaterialReader,
  newId,
  printCertificate,
  today,
} from "./CourseShared";

export default function CourseDetailPage() {
  const { id } = useParams();
  const {
    state,
    role,
    employeeId,
    enrollCourse,
    completeLesson,
    assignCourses,
    saveReview,
  } = useHr();
  const course = state.courses.find((item) => item.id === id);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [tab, setTab] = useState<
    "content" | "participants" | "results" | "reviews"
  >("content");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  useEffect(() => {
    const existing = state.reviews.find(
      (review) => review.courseId === id && review.employeeId === employeeId,
    );
    setRating(existing?.rating || 5);
    setReviewText(existing?.text || "");
  }, [id, employeeId]);
  if (!course)
    return (
      <EmptyState
        title="Курс не найден"
        description="Вернитесь в каталог и выберите курс."
      />
    );
  const allLessons = getCourseLessons(course);
  const assignment = state.assignments.find(
    (item) =>
      item.employeeId === employeeId &&
      item.courseId === course.id &&
      !item.cancelledAt,
  );
  const courseAssignments = state.assignments.filter(
    (item) => item.courseId === course.id && !item.cancelledAt,
  );
  if (role === "employee" && course.status !== "published" && !assignment)
    return (
      <EmptyState
        title="Курс недоступен"
        description="Курс ещё не опубликован или перенесён в архив."
      />
    );
  const progress = assignment
    ? getAssignmentProgress(state, assignment)
    : undefined;
  const certificate = assignment
    ? getCertificate(state, assignment)
    : undefined;
  const test = state.tests.find((item) => item.id === course.testId);
  const selectedLesson = allLessons.find(
    (lesson) => lesson.id === selectedLessonId,
  );
  const allRead =
    !!assignment &&
    allLessons.every((lesson) =>
      assignment.completedLessonIds.includes(lesson.id),
    );
  const attempts = assignment
    ? state.attempts
        .filter((attempt) => attempt.assignmentId === assignment.id)
        .sort((a, b) => b.number - a.number)
    : [];
  const visibleAttempts =
    attempts[0]?.testSnapshot.showHistory === false
      ? attempts.slice(0, 1)
      : attempts;
  const reviews = state.reviews
    .filter((review) => review.courseId === course.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const averageRating = reviews.length
    ? (
        reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      ).toFixed(1)
    : null;
  const activeEmployees = state.employees.filter(
    (employee) =>
      employee.status === "active" &&
      `${employee.name} ${employee.department}`
        .toLowerCase()
        .includes(employeeSearch.toLowerCase()),
  );
  const completedCount = courseAssignments.filter(
    (item) => getAssignmentProgress(state, item).isComplete,
  ).length;
  const action = (fn: () => void) => {
    setError("");
    try {
      fn();
    } catch (error) {
      setError(errorText(error));
    }
  };
  const assign = (event: FormEvent) => {
    event.preventDefault();
    action(() => {
      const count = assignCourses({
        employeeIds: selectedEmployees,
        courseIds: [course.id],
        deadline,
        required: true,
      });
      setNotice(`Курс назначен сотрудникам: ${count}.`);
      setAssignOpen(false);
      setSelectedEmployees([]);
    });
  };
  const markRead = () => {
    if (!assignment || !selectedLesson) return;
    action(() => {
      completeLesson(assignment.id, selectedLesson.id);
      const currentIndex = allLessons.findIndex(
        (lesson) => lesson.id === selectedLesson.id,
      );
      setSelectedLessonId(allLessons[currentIndex + 1]?.id || "");
      setNotice("Материал отмечен как изученный.");
    });
  };
  return (
    <>
      <Link
        to={role === "employee" ? "/my-learning" : "/courses"}
        className="back-link"
      >
        <ArrowLeft size={16} />{" "}
        {role === "employee" ? "Моё обучение" : "Каталог курсов"}
      </Link>
      <PageHeading
        title={course.title}
        subtitle={course.category}
        action={
          role === "hr" ? (
            <div className="actions">
              <Link
                to={`/courses/${course.id}/edit`}
                className="btn btn-outline"
              >
                <Pencil size={16} /> Изменить
              </Link>
              <Button
                disabled={course.status !== "published"}
                onClick={() => {
                  setError("");
                  setAssignOpen(true);
                }}
              >
                <Plus size={17} /> Назначить курс
              </Button>
            </div>
          ) : undefined
        }
      />
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
          <button
            className="btn btn-ghost"
            aria-label="Закрыть сообщение"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      <section
        className="panel course-summary"
        style={{ padding: 24, marginBottom: 22 }}
      >
        <div className="section-heading">
          <div className="actions">
            <Badge tone={course.status === "published" ? "green" : "gray"}>
              {entityLabels[course.status]}
            </Badge>
            <span className="muted">
              <Clock3 size={15} style={{ verticalAlign: "middle" }} />{" "}
              {course.durationHours} ч.
            </span>
            <span className="muted">
              <BookOpen size={15} style={{ verticalAlign: "middle" }} />{" "}
              {allLessons.length} материалов
            </span>
            {test && (
              <span className="muted">
                Итоговый тест · {test.passPercent}% для зачёта
              </span>
            )}
          </div>
          {role === "hr" && (
            <span className="muted">
              Обновлён {dateLabel(course.updatedAt)}
            </span>
          )}
        </div>
        <p style={{ lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
          {course.description}
        </p>
        {averageRating && (
          <p className="muted">
            <Star
              size={16}
              fill="#f2c55c"
              color="#d9a332"
              style={{ verticalAlign: "middle" }}
            />{" "}
            {averageRating} / 5 · Отзывов: {reviews.length}
          </p>
        )}
        {course.instructor && (
          <p className="muted">
            Преподаватель / автор: <strong>{course.instructor}</strong>
          </p>
        )}
        {!!course.tags?.filter(Boolean).length && (
          <div className="actions">
            {course.tags.filter(Boolean).map((tag, index) => (
              <Badge tone="gray" key={index}>
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {role === "employee" && progress && assignment && (
          <div style={{ marginTop: 20 }}>
            <div className="section-heading">
              <LearningBadge progress={progress} />
              <span className={progress.isOverdue ? "text-danger" : "muted"}>
                Срок: {dateLabel(assignment.deadline)}
              </span>
            </div>
            <Progress value={progress.progress} />
            <p className="muted small">
              Изучено материалов: {progress.completedLessons} из{" "}
              {progress.totalLessons}
              {progress.bestScore !== null
                ? ` · Лучший результат теста: ${progress.bestScore}%`
                : ""}
            </p>
            {progress.isComplete && (
              <CompletionNotice showCertificate={!!certificate} />
            )}
            {certificate && (
              <Button
                variant="outline"
                onClick={() =>
                  action(() =>
                    printCertificate(
                      certificate,
                      state.settings.organizationName,
                    ),
                  )
                }
              >
                <Award size={17} /> Сертификат
              </Button>
            )}
          </div>
        )}
        {role === "employee" && !assignment && (
          <div className="actions" style={{ marginTop: 20 }}>
            {course.allowSelfEnrollment !== false &&
            course.status === "published" ? (
              <Button
                onClick={() =>
                  action(() => {
                    enrollCourse(course.id);
                    setNotice(
                      "Вы записаны на курс. Можно приступать к обучению.",
                    );
                  })
                }
              >
                <GraduationCap size={18} /> Записаться на курс
              </Button>
            ) : (
              <p className="muted">
                Обратитесь в кадровую службу для назначения курса.
              </p>
            )}
          </div>
        )}
        {role === "hr" && (
          <div
            className="summary-grid"
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 16,
            }}
          >
            <div className="mini-stat">
              <span className="muted">Назначено сотрудникам</span>
              <strong style={{ display: "block", fontSize: 25 }}>
                {courseAssignments.length}
              </strong>
            </div>
            <div className="mini-stat">
              <span className="muted">Завершили обучение</span>
              <strong style={{ display: "block", fontSize: 25 }}>
                {completedCount}
              </strong>
            </div>
            <div className="mini-stat">
              <span className="muted">Доля завершения</span>
              <strong style={{ display: "block", fontSize: 25 }}>
                {courseAssignments.length
                  ? Math.round(
                      (completedCount / courseAssignments.length) * 100,
                    )
                  : 0}
                %
              </strong>
            </div>
          </div>
        )}
      </section>
      <div className="tabs">
        <button
          className={tab === "content" ? "active" : ""}
          onClick={() => setTab("content")}
        >
          Программа курса
        </button>
        {role === "hr" && (
          <button
            className={tab === "participants" ? "active" : ""}
            onClick={() => setTab("participants")}
          >
            Участники <span>{courseAssignments.length}</span>
          </button>
        )}
        {role === "employee" && assignment && (
          <button
            className={tab === "results" ? "active" : ""}
            onClick={() => setTab("results")}
          >
            Результаты тестирования
          </button>
        )}
        <button
          className={tab === "reviews" ? "active" : ""}
          onClick={() => setTab("reviews")}
        >
          Отзывы {reviews.length ? `(${reviews.length})` : ""}
        </button>
      </div>
      {tab === "content" && (
        <div className={selectedLesson ? "learning-layout" : ""}>
          <div className="panel curriculum" style={{ padding: 24 }}>
            <h2>Учебные материалы</h2>
            {!course.chapters.length && (
              <p className="muted">
                Этот курс состоит из итогового тестирования.
              </p>
            )}
            {course.chapters.map((chapter, chapterIndex) => (
              <details key={chapter.id} open style={{ marginTop: 14 }}>
                <summary
                  className="chapter-heading"
                  style={{
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "12px 0",
                  }}
                >
                  {chapterIndex + 1}. {chapter.title}{" "}
                  <span className="muted small">
                    · {chapter.lessons.length} материалов
                  </span>
                </summary>
                <div>
                  {chapter.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      className={`curriculum-lesson ${lesson.id === selectedLessonId ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedLessonId(lesson.id);
                        setNotice("");
                      }}
                      disabled={role === "employee" && !assignment}
                      style={{
                        display: "flex",
                        width: "100%",
                        textAlign: "left",
                        alignItems: "center",
                        gap: 12,
                        border: "1px solid #e5e9ef",
                        borderRadius: 8,
                        padding: 14,
                        marginBottom: 8,
                        background:
                          lesson.id === selectedLessonId ? "#edf4ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          color: assignment?.completedLessonIds.includes(
                            lesson.id,
                          )
                            ? "#21814a"
                            : "#67768a",
                        }}
                      >
                        {assignment?.completedLessonIds.includes(lesson.id) ? (
                          <CheckCircle2 size={19} />
                        ) : (
                          <LessonIcon type={lesson.type} />
                        )}
                      </span>
                      <span style={{ flex: 1 }}>{lesson.title}</span>
                      <span className="muted small">
                        {lesson.durationMinutes} мин.
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            ))}
            {test && (
              <div
                className="test-gate"
                style={{
                  marginTop: 20,
                  padding: 20,
                  background: "#f5f7fb",
                  borderRadius: 10,
                }}
              >
                <h3>
                  <GraduationCap
                    size={19}
                    style={{ verticalAlign: "middle" }}
                  />{" "}
                  Итоговое тестирование
                </h3>
                <p>{test.title}</p>
                <p className="muted small">
                  {test.questions.length} вопросов · {test.timeLimitMinutes}{" "}
                  мин. · Проходной балл {test.passPercent}% · Попыток:{" "}
                  {test.maxAttempts || "без ограничений"}
                </p>
                {role === "hr" ? (
                  <Link className="text-link" to={`/tests/${test.id}/edit`}>
                    Настройки теста
                  </Link>
                ) : !allRead ? (
                  <p className="muted">
                    <LockKeyhole
                      size={15}
                      style={{ verticalAlign: "middle" }}
                    />{" "}
                    Изучите все материалы, чтобы открыть тест.
                  </p>
                ) : progress?.isComplete ? (
                  <Badge tone="green">Тест сдан</Badge>
                ) : test.status !== "published" ? (
                  <p className="muted">Тест готовится к публикации.</p>
                ) : attempts[0]?.status === "pending_review" ? (
                  <Badge tone="amber">Ответы на проверке</Badge>
                ) : test.maxAttempts > 0 &&
                  attempts.filter((attempt) => attempt.status !== "in_progress")
                    .length >= test.maxAttempts &&
                  !attempts.some(
                    (attempt) => attempt.status === "in_progress",
                  ) ? (
                  <p className="text-danger">
                    Доступные попытки использованы. Обратитесь в кадровую
                    службу.
                  </p>
                ) : (
                  <Link
                    className="btn btn-primary"
                    to={`/tests/${test.id}/take?assignment=${assignment!.id}`}
                  >
                    <Play size={16} />{" "}
                    {attempts.some(
                      (attempt) => attempt.status === "in_progress",
                    )
                      ? "Продолжить тест"
                      : attempts.length
                        ? "Пройти повторно"
                        : "Начать тест"}
                  </Link>
                )}
              </div>
            )}
          </div>
          {selectedLesson && (
            <section className="panel" style={{ padding: 26 }}>
              <div className="section-heading">
                <span className="muted">
                  Материал{" "}
                  {allLessons.findIndex(
                    (lesson) => lesson.id === selectedLesson.id,
                  ) + 1}{" "}
                  из {allLessons.length}
                </span>
                <Button variant="ghost" onClick={() => setSelectedLessonId("")}>
                  Закрыть
                </Button>
              </div>
              <MaterialReader lesson={selectedLesson} />
              <div
                className="actions"
                style={{
                  marginTop: 28,
                  borderTop: "1px solid #e5e9ef",
                  paddingTop: 20,
                }}
              >
                {role === "employee" &&
                  assignment &&
                  !assignment.completedLessonIds.includes(
                    selectedLesson.id,
                  ) && (
                    <Button onClick={markRead}>
                      <Check size={17} /> Изучено, продолжить
                    </Button>
                  )}
                {role === "employee" &&
                  assignment?.completedLessonIds.includes(
                    selectedLesson.id,
                  ) && <Badge tone="green">Материал изучен</Badge>}
                {allLessons.findIndex(
                  (lesson) => lesson.id === selectedLesson.id,
                ) <
                  allLessons.length - 1 && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSelectedLessonId(
                        allLessons[
                          allLessons.findIndex(
                            (lesson) => lesson.id === selectedLesson.id,
                          ) + 1
                        ].id,
                      )
                    }
                  >
                    Следующий материал <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
      )}
      {tab === "participants" && role === "hr" && (
        <div className="panel table-wrap">
          {!courseAssignments.length ? (
            <EmptyState
              title="Участников пока нет"
              description="Назначьте опубликованный курс сотрудникам или подразделению."
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Подразделение</th>
                  <th>Срок</th>
                  <th>Прогресс</th>
                  <th>Результат теста</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {courseAssignments.map((item) => {
                  const employee = state.employees.find(
                    (employee) => employee.id === item.employeeId,
                  );
                  const itemProgress = getAssignmentProgress(state, item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          to={`/employees/${item.employeeId}`}
                          className="text-link"
                        >
                          {employee?.name || "Сотрудник"}
                        </Link>
                      </td>
                      <td>{employee?.department}</td>
                      <td
                        className={itemProgress.isOverdue ? "text-danger" : ""}
                      >
                        {dateLabel(item.deadline)}
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <Progress value={itemProgress.progress} />
                        <span className="muted small">
                          {itemProgress.completedLessons} /{" "}
                          {itemProgress.totalLessons} материалов
                        </span>
                      </td>
                      <td>
                        {itemProgress.bestScore === null
                          ? "—"
                          : `${itemProgress.bestScore}%`}
                      </td>
                      <td>
                        <LearningBadge progress={itemProgress} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "results" && (
        <div className="panel table-wrap">
          {!attempts.length ? (
            <EmptyState
              title="Попыток пока нет"
              description="Изучите материалы курса и пройдите итоговый тест."
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Попытка</th>
                  <th>Дата</th>
                  <th>Баллы</th>
                  <th>Результат</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>№ {attempt.number}</td>
                    <td>
                      {dateLabel(attempt.submittedAt || attempt.startedAt)}
                    </td>
                    <td>
                      {attempt.status === "pending_review" ||
                      attempt.status === "in_progress"
                        ? "—"
                        : `${attempt.score} / ${attempt.maxScore}`}
                    </td>
                    <td>
                      {attempt.status === "pending_review" ||
                      attempt.status === "in_progress"
                        ? "—"
                        : `${attempt.percent}%`}
                    </td>
                    <td>
                      <Badge
                        tone={
                          attempt.status === "passed"
                            ? "green"
                            : attempt.status === "failed"
                              ? "red"
                              : "amber"
                        }
                      >
                        {
                          {
                            passed: "Сдан",
                            failed: "Не сдан",
                            pending_review: "На проверке",
                            in_progress: "В процессе",
                          }[attempt.status]
                        }
                      </Badge>
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        to={
                          attempt.status === "in_progress"
                            ? `/tests/${attempt.testId}/take?assignment=${attempt.assignmentId}`
                            : `/results?attempt=${attempt.id}`
                        }
                      >
                        {attempt.status === "in_progress"
                          ? "Продолжить"
                          : "Подробнее"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "reviews" && (
        <section className="panel" style={{ padding: 24 }}>
          <h2>Отзывы о курсе</h2>
          {role === "employee" && assignment && (
            <form
              style={{
                borderBottom: "1px solid #e5e9ef",
                paddingBottom: 24,
                marginBottom: 24,
              }}
              onSubmit={(event) => {
                event.preventDefault();
                action(() => {
                  saveReview({
                    id: newId("review"),
                    courseId: course.id,
                    employeeId,
                    rating,
                    text: reviewText,
                    createdAt: new Date().toISOString(),
                  });
                  setNotice("Ваш отзыв сохранён.");
                });
              }}
            >
              <div className="form-grid">
                <Field label="Ваша оценка">
                  <select
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                  >
                    <option value={5}>5 — Отлично</option>
                    <option value={4}>4 — Хорошо</option>
                    <option value={3}>3 — Удовлетворительно</option>
                    <option value={2}>2 — Требует улучшения</option>
                    <option value={1}>1 — Неудовлетворительно</option>
                  </select>
                </Field>
              </div>
              <Field label="Отзыв *">
                <textarea
                  required
                  maxLength={5000}
                  rows={3}
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  placeholder="Какие материалы были полезны? Что стоит улучшить?"
                />
              </Field>
              <Button type="submit">Сохранить отзыв</Button>
            </form>
          )}
          {!reviews.length ? (
            <EmptyState
              title="Отзывов пока нет"
              description="Сотрудники, записанные на курс, могут поделиться обратной связью."
            />
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                style={{ padding: "18px 0", borderBottom: "1px solid #edf0f4" }}
              >
                <div className="section-heading">
                  <strong>
                    {state.employees.find(
                      (employee) => employee.id === review.employeeId,
                    )?.name || "Участник курса"}
                  </strong>
                  <span className="muted small">
                    {dateLabel(review.createdAt)}
                  </span>
                </div>
                <div
                  className="actions"
                  style={{ marginTop: 8, gap: 3 }}
                  aria-label={`Оценка ${review.rating} из 5`}
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      size={16}
                      fill={index < review.rating ? "#f2c55c" : "none"}
                      color={index < review.rating ? "#d9a332" : "#b7c0ce"}
                    />
                  ))}
                </div>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                  {review.text}
                </p>
              </article>
            ))
          )}
        </section>
      )}
      <Modal
        open={assignOpen}
        title="Назначить курс сотрудникам"
        onClose={() => setAssignOpen(false)}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Отмена
            </Button>
            <Button
              form="assign-course-form"
              type="submit"
              disabled={!selectedEmployees.length}
            >
              Назначить ({selectedEmployees.length})
            </Button>
          </>
        }
      >
        <form id="assign-course-form" onSubmit={assign}>
          <p>
            <strong>{course.title}</strong>
          </p>
          {error && <div className="alert error">{error}</div>}
          <Field label="Срок завершения *">
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              min={today()}
              required
            />
          </Field>
          <Field label="Сотрудники">
            <input
              placeholder="Поиск по ФИО или подразделению"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
            />
          </Field>
          <div className="actions" style={{ marginBottom: 12 }}>
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                setSelectedEmployees([
                  ...new Set([
                    ...selectedEmployees,
                    ...activeEmployees.map((employee) => employee.id),
                  ]),
                ])
              }
            >
              Выбрать найденных
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setSelectedEmployees([])}
            >
              Очистить
            </Button>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {activeEmployees.map((employee) => (
              <label
                key={employee.id}
                className="check-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 0",
                  borderBottom: "1px solid #edf0f4",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(employee.id)}
                  onChange={(event) =>
                    setSelectedEmployees(
                      event.target.checked
                        ? [...selectedEmployees, employee.id]
                        : selectedEmployees.filter((id) => id !== employee.id),
                    )
                  }
                />
                <span>
                  <strong>{employee.name}</strong>
                  <span className="muted small" style={{ display: "block" }}>
                    {employee.department} · {employee.position}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="muted small">
            Повторное назначение уже активного курса будет пропущено.
          </p>
        </form>
      </Modal>
    </>
  );
}
