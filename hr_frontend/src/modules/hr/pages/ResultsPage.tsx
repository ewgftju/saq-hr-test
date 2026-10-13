import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  StatCard,
} from "../../../components/ui";
import type { Attempt, Question } from "../../../api/types";
import { useHr } from "../../../store/HrContext";
import {
  attemptStatusLabels,
  attemptTones,
  dateTime,
  downloadCsv,
} from "../components/TestsUtils";

function answerText(question: Question, answers: string[] = []) {
  return (
    answers
      .map(
        (answer) =>
          question.options.find((option) => option.id === answer)?.text ??
          answer,
      )
      .join("; ") || "Ответ не дан"
  );
}

export default function ResultsPage() {
  const { state, role, employeeId, reviewAttempt } = useHr();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(() => params.get("status") ?? "all");
  const [testId, setTestId] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState(
    () => params.get("employee") ?? "all",
  );
  const [courseFilter, setCourseFilter] = useState(
    () => params.get("course") ?? "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    params.get("attempt"),
  );
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visible = useMemo(() => {
    const list = state.attempts
      .filter((attempt) => role === "hr" || attempt.employeeId === employeeId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    if (role === "hr") return list;
    const latest = new Map<string, Attempt>();
    for (const attempt of list) {
      const key = `${attempt.assignmentId}-${attempt.testId}`;
      if (!latest.has(key)) latest.set(key, attempt);
    }
    return list.filter((attempt) => {
      const last = latest.get(`${attempt.assignmentId}-${attempt.testId}`)!;
      return last.testSnapshot.showHistory || last.id === attempt.id;
    });
  }, [state.attempts, role, employeeId]);
  const filtered = visible.filter((attempt) => {
    const employee = state.employees.find(
      (item) => item.id === attempt.employeeId,
    );
    const haystack =
      `${employee?.name ?? ""} ${employee?.department ?? ""} ${attempt.testSnapshot.title}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (status === "all" || attempt.status === status) &&
      (testId === "all" || attempt.testId === testId) &&
      (role !== "hr" ||
        employeeFilter === "all" ||
        attempt.employeeId === employeeFilter) &&
      (courseFilter === "all" || attempt.courseId === courseFilter)
    );
  });
  const selected = visible.find((attempt) => attempt.id === selectedId);
  const completed = filtered.filter(
    (attempt) => attempt.status === "passed" || attempt.status === "failed",
  );
  const average = completed.length
    ? Math.round(
        completed.reduce((sum, attempt) => sum + attempt.percent, 0) /
          completed.length,
      )
    : null;
  const tests = [
    ...new Map(
      visible.map((attempt) => [attempt.testId, attempt.testSnapshot.title]),
    ).entries(),
  ];

  function open(attempt: Attempt) {
    setSelectedId(attempt.id);
    setError("");
    setMessage("");
    setScores(
      Object.fromEntries(
        attempt.questions
          .filter((question) => question.type === "open")
          .map((question) => [
            question.id,
            attempt.reviewedAt
              ? String(attempt.questionScores[question.id] ?? 0)
              : "",
          ]),
      ),
    );
    setComments({ ...attempt.reviewComments });
  }
  function review() {
    if (!selected) return;
    setError("");
    const openQuestions = selected.questions.filter(
      (question) => question.type === "open",
    );
    for (const question of openQuestions) {
      const value = scores[question.id];
      if (
        value === undefined ||
        !value.trim() ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0 ||
        Number(value) > question.points
      ) {
        setError(
          `Оцените каждый развёрнутый ответ: от 0 до максимального балла вопроса. Для вопроса «${question.text.slice(0, 70)}» максимум ${question.points}.`,
        );
        return;
      }
    }
    try {
      reviewAttempt(selected.id, {
        scores: Object.fromEntries(
          openQuestions.map((question) => [
            question.id,
            Number(scores[question.id]),
          ]),
        ),
        comments,
      });
      setMessage(
        "Проверка завершена. Итоговый результат и статус обучения обновлены.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function exportResults() {
    downloadCsv("SAQ-rezultaty-testirovaniya.csv", [
      [
        "Сотрудник",
        "Подразделение",
        "Курс",
        "Тест",
        "Попытка",
        "Начало",
        "Завершение",
        "Статус",
        "Баллы",
        "Максимум",
        "Результат, %",
        "Порог, %",
        "Проверено",
      ],
      ...filtered.map((attempt) => {
        const employee = state.employees.find(
          (item) => item.id === attempt.employeeId,
        );
        return [
          employee?.name ?? "—",
          employee?.department ?? "—",
          state.courses.find((item) => item.id === attempt.courseId)?.title ??
            "—",
          attempt.testSnapshot.title,
          attempt.number,
          dateTime(attempt.startedAt),
          dateTime(attempt.submittedAt),
          attemptStatusLabels[attempt.status],
          attempt.score,
          attempt.maxScore,
          attempt.percent,
          attempt.testSnapshot.passPercent,
          dateTime(attempt.reviewedAt),
        ];
      }),
    ]);
  }
  const showCorrect =
    selected &&
    (role === "hr" ||
      (selected.testSnapshot.showAnswers &&
        selected.status !== "in_progress" &&
        selected.status !== "pending_review"));
  const canReview = role === "hr" && selected?.status === "pending_review";
  return (
    <div className="page">
      <PageHeading
        title={role === "hr" ? "Результаты и проверка" : "Мои результаты"}
        subtitle={
          role === "hr"
            ? "Все попытки сотрудников, автоматические оценки и проверка развёрнутых ответов."
            : "Ваши результаты тестирования и обратная связь кадровой службы."
        }
        action={
          <Button
            variant="outline"
            disabled={!filtered.length}
            onClick={exportResults}
          >
            Выгрузить CSV
          </Button>
        }
      />
      <div
        className="cards"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 16,
        }}
      >
        <StatCard
          value={
            filtered.filter((attempt) => attempt.status === "passed").length
          }
          label="Успешно сданы"
          caption="Попытки с проходным результатом"
          tone="green"
        />
        <StatCard
          value={
            filtered.filter((attempt) => attempt.status === "pending_review")
              .length
          }
          label="Ожидают проверки"
          caption="Есть развёрнутые ответы"
          tone="amber"
        />
        <StatCard
          value={average === null ? "—" : `${average}%`}
          label="Средний результат"
          caption="По оценённым попыткам"
        />
      </div>
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Поиск результатов"
            placeholder={
              role === "hr"
                ? "Сотрудник, подразделение или тест"
                : "Поиск по тесту"
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ minWidth: 240 }}
          />
          <select
            aria-label="Фильтр по статусу"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Все статусы</option>
            {Object.entries(attemptStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Фильтр по тесту"
            value={testId}
            onChange={(event) => setTestId(event.target.value)}
          >
            <option value="all">Все тесты</option>
            {tests.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <span className="muted">Попыток: {filtered.length}</span>
        </div>
        {(employeeFilter !== "all" || courseFilter !== "all") && (
          <div className="toolbar">
            <span className="muted">
              Выбрано:{" "}
              {[
                employeeFilter !== "all"
                  ? (state.employees.find((item) => item.id === employeeFilter)
                      ?.name ?? "Сотрудник не найден")
                  : "",
                courseFilter !== "all"
                  ? (state.courses.find((item) => item.id === courseFilter)
                      ?.title ?? "Курс не найден")
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmployeeFilter("all");
                setCourseFilter("all");
              }}
            >
              Показать все результаты
            </Button>
          </div>
        )}
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {role === "hr" && <th>Сотрудник</th>}
                  <th>Тест / курс</th>
                  <th>Попытка</th>
                  <th>Результат</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((attempt) => {
                  const employee = state.employees.find(
                    (item) => item.id === attempt.employeeId,
                  );
                  return (
                    <tr key={attempt.id}>
                      {role === "hr" && (
                        <td>
                          <strong>
                            {employee?.name ?? "Сотрудник удалён"}
                          </strong>
                          <div className="muted">{employee?.department}</div>
                        </td>
                      )}
                      <td>
                        <strong>{attempt.testSnapshot.title}</strong>
                        <div className="muted">
                          {state.courses.find(
                            (item) => item.id === attempt.courseId,
                          )?.title ?? "—"}
                        </div>
                      </td>
                      <td>№ {attempt.number}</td>
                      <td>
                        {attempt.status === "in_progress" ? (
                          "—"
                        ) : (
                          <>
                            <strong
                              style={{
                                color:
                                  attempt.status === "passed"
                                    ? "#15803d"
                                    : attempt.status === "failed"
                                      ? "#b91c1c"
                                      : undefined,
                              }}
                            >
                              {Math.round(attempt.percent)}%
                            </strong>
                            <div className="muted">
                              {attempt.score} / {attempt.maxScore} балл.
                            </div>
                            {attempt.status === "pending_review" && (
                              <small className="muted">Предварительно</small>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        <Badge tone={attemptTones[attempt.status]}>
                          {attemptStatusLabels[attempt.status]}
                        </Badge>
                      </td>
                      <td>
                        {dateTime(attempt.submittedAt ?? attempt.startedAt)}
                      </td>
                      <td>
                        <Button
                          variant={
                            attempt.status === "pending_review" && role === "hr"
                              ? "primary"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => open(attempt)}
                        >
                          {attempt.status === "pending_review" && role === "hr"
                            ? "Проверить"
                            : "Подробнее"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Результатов пока нет"
            description={
              role === "hr"
                ? "Результаты появятся после начала тестирования. Также проверьте выбранные фильтры."
                : "Пройдите итоговый тест в назначенном курсе."
            }
            action={
              role === "employee" ? (
                <Link className="btn btn-primary" to="/my-learning">
                  К моему обучению
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
      <Modal
        open={Boolean(selected)}
        title={
          canReview ? "Проверка развёрнутых ответов" : "Подробности попытки"
        }
        wide
        onClose={() => {
          setSelectedId(null);
          setError("");
          setMessage("");
        }}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              Закрыть
            </Button>
            {canReview && <Button onClick={review}>Завершить проверку</Button>}
          </>
        }
      >
        {selected && (
          <>
            <div className="section-heading">
              <div>
                <h3>{selected.testSnapshot.title}</h3>
                <p className="muted">
                  {
                    state.employees.find(
                      (employee) => employee.id === selected.employeeId,
                    )?.name
                  }{" "}
                  · Попытка № {selected.number}
                </p>
              </div>
              <Badge tone={attemptTones[selected.status]}>
                {attemptStatusLabels[selected.status]}
              </Badge>
            </div>
            <div
              className="form-grid"
              style={{
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                marginBottom: 22,
              }}
            >
              <div>
                <span className="muted">Результат</span>
                <p>
                  <strong>
                    {selected.status === "in_progress"
                      ? "Тест ещё не завершён"
                      : `${selected.score} / ${selected.maxScore} балл. (${Math.round(selected.percent)}%)`}
                  </strong>
                </p>
              </div>
              <div>
                <span className="muted">Проходной результат</span>
                <p>
                  <strong>{selected.testSnapshot.passPercent}%</strong>
                </p>
              </div>
              <div>
                <span className="muted">Завершено</span>
                <p>{dateTime(selected.submittedAt)}</p>
              </div>
            </div>
            {selected.status === "pending_review" && (
              <p className="notice">
                Итоговый балл будет рассчитан после проверки всех развёрнутых
                ответов.
              </p>
            )}
            {selected.status === "in_progress" && role === "employee" && (
              <p>
                <Link
                  className="btn btn-primary"
                  to={`/tests/${selected.testId}/take?assignment=${encodeURIComponent(selected.assignmentId)}`}
                >
                  Продолжить тест
                </Link>
              </p>
            )}
            {selected.status !== "in_progress" &&
              selected.questions.map((question, index) => (
                <section
                  className="panel"
                  key={question.id}
                  style={{ marginTop: 16, background: "#fafbfc" }}
                >
                  <div className="section-heading">
                    <strong>Вопрос {index + 1}</strong>
                    <span className="muted">
                      {question.type === "open" &&
                      selected.status === "pending_review"
                        ? `Максимум ${question.points} балл.`
                        : `${selected.questionScores[question.id] ?? 0} / ${question.points} балл.`}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, whiteSpace: "pre-wrap" }}>
                    {question.text}
                  </p>
                  <p className="muted" style={{ marginBottom: 5 }}>
                    Ответ сотрудника
                  </p>
                  <div
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {answerText(question, selected.answers[question.id])}
                  </div>
                  {showCorrect && question.type !== "open" && (
                    <div style={{ marginTop: 14 }}>
                      <span className="muted">Правильный ответ</span>
                      <p style={{ marginTop: 5, color: "#15803d" }}>
                        {answerText(question, question.correctAnswers)}
                      </p>
                    </div>
                  )}
                  {showCorrect && question.explanation && (
                    <p className="notice" style={{ whiteSpace: "pre-wrap" }}>
                      {question.type === "open"
                        ? "Критерии проверки: "
                        : "Пояснение: "}
                      {question.explanation}
                    </p>
                  )}
                  {question.type === "open" && canReview ? (
                    <div
                      className="form-grid"
                      style={{
                        marginTop: 18,
                        gridTemplateColumns: "140px minmax(0,1fr)",
                      }}
                    >
                      <Field label={`Балл (0–${question.points})`} required>
                        <input
                          type="number"
                          min={0}
                          max={question.points}
                          step={0.25}
                          value={scores[question.id] ?? ""}
                          onChange={(event) =>
                            setScores((current) => ({
                              ...current,
                              [question.id]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Комментарий сотруднику">
                        <textarea
                          rows={2}
                          value={comments[question.id] ?? ""}
                          onChange={(event) =>
                            setComments((current) => ({
                              ...current,
                              [question.id]: event.target.value,
                            }))
                          }
                          placeholder="При необходимости поясните оценку"
                        />
                      </Field>
                    </div>
                  ) : (
                    selected.reviewComments[question.id] && (
                      <p className="notice" style={{ whiteSpace: "pre-wrap" }}>
                        Комментарий проверяющего:{" "}
                        {selected.reviewComments[question.id]}
                      </p>
                    )
                  )}
                </section>
              ))}
            {selected.reviewedAt && (
              <p className="muted">
                Проверено: {dateTime(selected.reviewedAt)}
              </p>
            )}
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="alert alert-success" role="status">
                {message}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
