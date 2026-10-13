import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeading,
  Progress,
} from "../../../components/ui";
import { useHr } from "../../../store/HrContext";
import {
  attemptStatusLabels,
  attemptTones,
  isAnswered,
} from "../components/TestsUtils";

export default function TestPlayerPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    state,
    role,
    employeeId,
    beginAttempt,
    saveAttemptAnswers,
    submitAttempt,
  } = useHr();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [activeId, setActiveId] = useState<string | null>(null);
  const submitting = useRef(false);
  const test = state.tests.find((item) => item.id === id);
  const requestedAssignment = params.get("assignment");
  const assignment = state.assignments.find(
    (item) =>
      item.employeeId === employeeId &&
      !item.cancelledAt &&
      (requestedAssignment
        ? item.id === requestedAssignment
        : state.courses.find((course) => course.id === item.courseId)
            ?.testId === id),
  );
  const course = state.courses.find((item) => item.id === assignment?.courseId);
  const history = state.attempts
    .filter(
      (item) =>
        item.assignmentId === assignment?.id &&
        item.testId === id &&
        item.employeeId === employeeId,
    )
    .sort((a, b) => b.number - a.number);
  const attempt =
    history.find((item) => item.id === activeId) ??
    history.find((item) => item.status === "in_progress");
  const latest = history[0];
  const duration = attempt?.expiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(attempt.expiresAt).getTime() - now) / 1000),
      )
    : null;
  const active = attempt?.status === "in_progress";
  const allLessons =
    course?.chapters.flatMap((chapter) => chapter.lessons) ?? [];
  const completedLessons = allLessons.filter((lesson) =>
    assignment?.completedLessonIds.includes(lesson.id),
  ).length;
  const lessonsDone = completedLessons === allLessons.length;
  const answered =
    attempt?.questions.filter((question) =>
      isAnswered(attempt.answers[question.id]),
    ).length ?? 0;
  const question = attempt?.questions[current];
  const answer =
    question && attempt ? (attempt.answers[question.id] ?? []) : [];

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [active, attempt?.id]);
  useEffect(() => {
    if (!active || duration !== 0 || !attempt || submitting.current) return;
    submitting.current = true;
    try {
      submitAttempt(attempt.id);
      setActiveId(attempt.id);
      setConfirm(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      submitting.current = false;
    }
  }, [active, duration, attempt, submitAttempt]);
  useEffect(() => {
    setCurrent(0);
    setActiveId(null);
    setError("");
    setConfirm(false);
  }, [id, requestedAssignment, employeeId]);

  function start() {
    if (!assignment) return;
    setError("");
    try {
      const next = beginAttempt(assignment.id);
      setActiveId(next.id);
      setCurrent(0);
      setNow(Date.now());
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function updateAnswer(value: string[]) {
    if (!attempt || !question) return;
    try {
      saveAttemptAnswers(attempt.id, {
        ...attempt.answers,
        [question.id]: value,
      });
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function finish() {
    if (!attempt || submitting.current) return;
    submitting.current = true;
    setError("");
    try {
      submitAttempt(attempt.id);
      setActiveId(attempt.id);
      setConfirm(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      submitting.current = false;
    }
  }
  if (role !== "employee")
    return (
      <div className="page">
        <PageHeading title="Прохождение теста" />
        <EmptyState
          title="Переключитесь на роль сотрудника"
          description="Для прохождения нужен курс, назначенный выбранному сотруднику."
        />
        <Link to="/tests">К тестам</Link>
      </div>
    );
  if (!test || !assignment || !course || course.testId !== id)
    return (
      <div className="page">
        <EmptyState
          title="Тест не назначен"
          description="Откройте тест из назначенного вам курса."
        />
        <Link to="/my-learning">К моему обучению</Link>
      </div>
    );
  const currentTest = attempt?.testSnapshot ?? test;
  const result =
    attempt && !active
      ? attempt
      : !active && latest && latest.status !== "in_progress"
        ? latest
        : null;
  const canRetry = !test.maxAttempts || history.length < test.maxAttempts;

  if (result && !active)
    return (
      <div className="page">
        <PageHeading
          title="Результат тестирования"
          subtitle={result.testSnapshot.title}
        />
        <section
          className="panel"
          style={{ textAlign: "center", padding: "40px 24px" }}
        >
          <Badge tone={attemptTones[result.status]}>
            {attemptStatusLabels[result.status]}
          </Badge>
          <div
            style={{
              fontSize: 54,
              fontWeight: 700,
              margin: "20px 0",
              color:
                result.status === "passed"
                  ? "#15803d"
                  : result.status === "failed"
                    ? "#b91c1c"
                    : "#a16207",
            }}
          >
            {Math.round(result.percent)}%
          </div>
          <h3>
            {result.status === "passed"
              ? "Тест успешно сдан"
              : result.status === "pending_review"
                ? "Ответы переданы на проверку"
                : "Проходной результат пока не достигнут"}
          </h3>
          <p className="muted">
            {result.score} из {result.maxScore} баллов · Проходной результат:{" "}
            {result.testSnapshot.passPercent}% · Попытка {result.number}
          </p>
          {result.status === "pending_review" && (
            <p>
              Это предварительный балл. Итог появится после проверки развёрнутых
              ответов кадровой службой.
            </p>
          )}
          <div
            className="actions"
            style={{ justifyContent: "center", marginTop: 24 }}
          >
            <Button
              onClick={() =>
                navigate(`/results?attempt=${encodeURIComponent(result.id)}`)
              }
            >
              Посмотреть результат
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              Вернуться к курсу
            </Button>
            {result.status === "failed" &&
              canRetry &&
              test.status === "published" && (
                <Button variant="outline" onClick={start}>
                  Пройти ещё раз
                </Button>
              )}
          </div>
          {result.status === "failed" && !canRetry && (
            <p className="muted">
              Все доступные попытки использованы. Обратитесь в кадровую службу.
            </p>
          )}
          {error && (
            <div
              className="alert alert-error"
              role="alert"
              style={{ marginTop: 16 }}
            >
              {error}
            </div>
          )}
        </section>
      </div>
    );
  if (!active || !attempt || !question)
    return (
      <div className="page">
        <Link to={`/courses/${course.id}`}>← {course.title}</Link>
        <PageHeading title={test.title} subtitle={test.description} />
        <section className="panel">
          <h3>Перед началом теста</h3>
          <div
            className="form-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            }}
          >
            <div>
              <p className="muted">Вопросов</p>
              <strong>
                {test.questionLimit
                  ? Math.min(test.questionLimit, test.questions.length)
                  : test.questions.length}
              </strong>
            </div>
            <div>
              <p className="muted">Время</p>
              <strong>
                {test.timeLimitMinutes
                  ? `${test.timeLimitMinutes} минут`
                  : "Без ограничения"}
              </strong>
            </div>
            <div>
              <p className="muted">Проходной результат</p>
              <strong>{test.passPercent}%</strong>
            </div>
            <div>
              <p className="muted">Доступно попыток</p>
              <strong>
                {test.maxAttempts
                  ? Math.max(0, test.maxAttempts - history.length)
                  : "Без ограничения"}
              </strong>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            Ответы сохраняются автоматически. Если вы закроете страницу, сможете
            продолжить ту же попытку. Отсчёт времени при этом продолжается.
          </p>
          {test.questions.some((item) => item.type === "open") && (
            <p className="notice">
              В тесте есть развёрнутые ответы. Их проверит кадровая служба.
            </p>
          )}
          {test.allowNegativeMarking && (
            <p className="notice">
              За каждый неверный ответ начисляется штраф {test.negativePoints}{" "}
              балла. Пропущенные ответы не штрафуются.
            </p>
          )}
          {!lessonsDone && (
            <div className="alert alert-warning">
              Сначала изучите все материалы курса: завершено {completedLessons}{" "}
              из {allLessons.length}.
            </div>
          )}
          {test.status !== "published" && (
            <div className="alert alert-warning">
              Тест сейчас не опубликован. Обратитесь в кадровую службу.
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <div className="actions" style={{ marginTop: 24 }}>
            <Button
              onClick={start}
              disabled={
                !lessonsDone || !canRetry || test.status !== "published"
              }
            >
              Начать тест
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              Вернуться к материалам
            </Button>
          </div>
        </section>
      </div>
    );
  return (
    <div className="page">
      <PageHeading
        title={currentTest.title}
        subtitle={`Попытка ${attempt.number} · ${course.title}`}
        action={
          <div
            className="panel"
            style={{
              padding: "12px 18px",
              color:
                duration !== null && duration < 120 ? "#b91c1c" : undefined,
            }}
          >
            <span className="muted">Осталось времени</span>
            <strong
              style={{
                display: "block",
                fontSize: 24,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {duration === null
                ? "Без ограничения"
                : `${Math.floor(duration / 60)
                    .toString()
                    .padStart(
                      2,
                      "0",
                    )}:${(duration % 60).toString().padStart(2, "0")}`}
            </strong>
          </div>
        }
      />
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="section-heading">
          <span>
            Отвечено:{" "}
            <strong>
              {answered} из {attempt.questions.length}
            </strong>
          </span>
          <span className="muted">Ответы сохраняются автоматически</span>
        </div>
        <Progress
          value={(answered / attempt.questions.length) * 100}
          label="Вопросы с ответом"
        />
        <div className="actions" style={{ flexWrap: "wrap", marginTop: 16 }}>
          {attempt.questions.map((item, index) => (
            <Button
              key={item.id}
              size="sm"
              variant={
                current === index
                  ? "primary"
                  : isAnswered(attempt.answers[item.id])
                    ? "secondary"
                    : "outline"
              }
              aria-label={`Вопрос ${index + 1}${isAnswered(attempt.answers[item.id]) ? ", ответ дан" : ", без ответа"}`}
              aria-current={current === index ? "step" : undefined}
              onClick={() => setCurrent(index)}
            >
              {index + 1}
              {isAnswered(attempt.answers[item.id]) ? " ✓" : ""}
            </Button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <Badge tone="blue">
            Вопрос {current + 1} из {attempt.questions.length}
          </Badge>
          <span className="muted">Максимум {question.points} балл.</span>
        </div>
        <h3
          style={{
            marginTop: 22,
            fontSize: 20,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {question.text}
        </h3>
        {(question.type === "single" || question.type === "multiple") && (
          <fieldset style={{ border: 0, padding: 0, margin: "20px 0" }}>
            <legend className="muted" style={{ marginBottom: 12 }}>
              {question.type === "single"
                ? "Выберите один ответ"
                : "Выберите все правильные ответы"}
            </legend>
            {question.options.map((option) => (
              <label
                key={option.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 15,
                  border: `1px solid ${answer.includes(option.id) ? "#006196" : "#e2e8f0"}`,
                  borderRadius: 8,
                  marginBottom: 10,
                  cursor: "pointer",
                  background: answer.includes(option.id) ? "#eef4f8" : "#fff",
                }}
              >
                <input
                  style={{ marginTop: 3 }}
                  type={question.type === "single" ? "radio" : "checkbox"}
                  name={`answer-${question.id}`}
                  checked={answer.includes(option.id)}
                  onChange={(event) =>
                    updateAnswer(
                      question.type === "single"
                        ? [option.id]
                        : event.target.checked
                          ? [...answer, option.id]
                          : answer.filter((value) => value !== option.id),
                    )
                  }
                />
                <span>{option.text}</span>
              </label>
            ))}
          </fieldset>
        )}
        {question.type === "text" && (
          <label className="field">
            <span className="field-label">Ваш ответ</span>
            <input
              value={answer[0] ?? ""}
              maxLength={1000}
              onChange={(event) => updateAnswer([event.target.value])}
              placeholder="Введите короткий ответ"
            />
          </label>
        )}
        {question.type === "open" && (
          <label className="field">
            <span className="field-label">Ваш развёрнутый ответ</span>
            <textarea
              rows={8}
              value={answer[0] ?? ""}
              maxLength={20000}
              onChange={(event) => updateAnswer([event.target.value])}
              placeholder="Изложите ответ своими словами"
            />
            <small className="muted">Ответ проверит кадровая служба.</small>
          </label>
        )}
        <div
          className="actions"
          style={{ marginTop: 24, justifyContent: "space-between" }}
        >
          <Button
            variant="outline"
            disabled={current === 0}
            onClick={() => setCurrent((index) => Math.max(0, index - 1))}
          >
            ← Предыдущий
          </Button>
          <Button
            variant="ghost"
            disabled={!isAnswered(answer)}
            onClick={() => updateAnswer([])}
          >
            Очистить ответ
          </Button>
          {current < attempt.questions.length - 1 ? (
            <Button onClick={() => setCurrent((index) => index + 1)}>
              Следующий →
            </Button>
          ) : (
            <Button onClick={() => setConfirm(true)}>Завершить тест</Button>
          )}
        </div>
      </section>
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <Link to="/my-learning">Вернуться к обучению</Link>
        <Button variant="outline" onClick={() => setConfirm(true)}>
          Завершить тестирование
        </Button>
      </div>
      <Modal
        open={confirm}
        title="Завершить тестирование?"
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Продолжить тест
            </Button>
            <Button onClick={finish}>Завершить и отправить</Button>
          </>
        }
      >
        <p>
          Вы ответили на {answered} из {attempt.questions.length} вопросов.
        </p>
        {answered < attempt.questions.length && (
          <p className="alert alert-warning">
            Без ответа: {attempt.questions.length - answered}. За пропущенные
            вопросы будет начислено 0 баллов.
          </p>
        )}
        <p>После отправки изменить ответы в этой попытке будет нельзя.</p>
      </Modal>
    </div>
  );
}
