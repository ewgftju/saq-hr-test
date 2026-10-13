import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeading,
} from "../../../components/ui";
import type {
  EntityStatus,
  Question,
  QuestionType,
  Test,
} from "../../../api/types";
import { useHr } from "../../../store/HrContext";
import {
  downloadQuestionTemplate,
  importQuestions,
  newQuestion,
  newTestId,
  questionTypeLabels,
  testStatusLabels,
  validateQuestion,
} from "../components/TestsUtils";

export default function TestEditorPage() {
  const { id } = useParams();
  return <TestEditor key={id ?? "new"} testId={id} />;
}

function TestEditor({ testId }: { testId?: string }) {
  const { state, role, saveTest } = useHr();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const source = state.tests.find((test) => test.id === testId);
  const [test, setTest] = useState<Test>(() =>
    source
      ? structuredClone(source)
      : {
          id: newTestId("test"),
          title: "",
          description: "",
          questions: [newQuestion()],
          timeLimitMinutes: state.settings.defaultTimeLimitMinutes,
          passPercent: state.settings.defaultPassPercent,
          maxAttempts: state.settings.defaultMaxAttempts,
          shuffleQuestions: true,
          shuffleAnswers: true,
          allowNegativeMarking: false,
          negativePoints: 0.25,
          questionLimit: 0,
          showAnswers: true,
          showHistory: true,
          status: "draft",
        },
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [leave, setLeave] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (role !== "hr")
    return (
      <div className="page">
        <EmptyState title="Редактирование доступно кадровой службе" />
        <Link to="/my-learning">К моему обучению</Link>
      </div>
    );
  if (testId && !source)
    return (
      <div className="page">
        <EmptyState title="Тест не найден" />
        <Link to="/tests">К списку тестов</Link>
      </div>
    );
  const update = (patch: Partial<Test>) => {
    setTest((current) => ({ ...current, ...patch }));
    setDirty(true);
    setMessage("");
  };
  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setTest((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    }));
    setDirty(true);
    setMessage("");
  };
  function save(status: EntityStatus) {
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const normalized = {
      ...test,
      questions: test.questions.map((question) => ({
        ...question,
        text: question.text.trim(),
        options: question.options.map((option) => ({
          ...option,
          text: option.text.trim(),
        })),
        correctAnswers:
          question.type === "text"
            ? question.correctAnswers
                .map((answer) => answer.trim())
                .filter(Boolean)
            : question.correctAnswers,
      })),
    };
    if (!test.title.trim()) {
      setError("Укажите название теста.");
      return;
    }
    if (
      !Number.isFinite(test.passPercent) ||
      test.passPercent < 1 ||
      test.passPercent > 100
    ) {
      setError("Проходной балл должен быть от 1 до 100%.");
      return;
    }
    if (
      !Number.isInteger(test.timeLimitMinutes) ||
      test.timeLimitMinutes < 0 ||
      test.timeLimitMinutes > 1440
    ) {
      setError("Время прохождения — целое число от 0 до 1440 минут.");
      return;
    }
    if (
      !Number.isInteger(test.maxAttempts) ||
      test.maxAttempts < 0 ||
      test.maxAttempts > 100
    ) {
      setError(
        "Число попыток — от 0 до 100. Значение 0 означает отсутствие ограничения.",
      );
      return;
    }
    if (
      !Number.isInteger(test.questionLimit) ||
      test.questionLimit < 0 ||
      test.questionLimit > test.questions.length
    ) {
      setError(
        "Число вопросов в попытке не должно превышать число вопросов в тесте.",
      );
      return;
    }
    if (
      test.allowNegativeMarking &&
      (!Number.isFinite(test.negativePoints) || test.negativePoints <= 0)
    ) {
      setError("Укажите штраф за неверный ответ больше нуля.");
      return;
    }
    if (!test.questions.length) {
      setError("Добавьте хотя бы один вопрос.");
      return;
    }
    const invalid = normalized.questions.map(validateQuestion).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    try {
      const id = saveTest({
        ...normalized,
        title: test.title.trim(),
        description: test.description.trim(),
        status,
      });
      setTest({ ...normalized, status });
      setDirty(false);
      setMessage(
        status === "published"
          ? "Тест опубликован. Его можно выбрать в настройках курса."
          : "Изменения сохранены.",
      );
      if (!testId) navigate(`/tests/${id}/edit`, { replace: true });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function onImport(file?: File) {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const questions = await importQuestions(file);
      const nonBlank = test.questions.filter((question) =>
        question.text.trim(),
      );
      update({ questions: [...nonBlank, ...questions] });
      setMessage(
        `Импортировано вопросов: ${questions.length}. Проверьте содержание и сохраните тест.`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  function changeType(question: Question, type: QuestionType) {
    const fresh = newQuestion(type);
    const sameFamily =
      ["single", "multiple"].includes(type) &&
      ["single", "multiple"].includes(question.type);
    updateQuestion(question.id, {
      type,
      options: sameFamily ? question.options : fresh.options,
      correctAnswers: sameFamily
        ? type === "single"
          ? question.correctAnswers.slice(0, 1)
          : question.correctAnswers
        : [],
    });
  }
  const totalPoints = test.questions.reduce(
    (sum, question) =>
      sum + (Number.isFinite(question.points) ? question.points : 0),
    0,
  );
  return (
    <div className="page">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (dirty ? setLeave(true) : navigate("/tests"))}
        >
          ← К списку тестов
        </Button>
      </div>
      <PageHeading
        title={testId ? "Редактирование теста" : "Новый тест"}
        subtitle="Настройте вопросы, правильные ответы и условия прохождения."
        action={
          <div className="actions">
            <Button
              variant="outline"
              onClick={() =>
                save(test.status === "published" ? "published" : "draft")
              }
            >
              Сохранить
            </Button>
            {test.status !== "published" && (
              <Button onClick={() => save("published")}>Опубликовать</Button>
            )}
          </div>
        }
      />
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
      <section className="panel">
        <div className="section-heading">
          <h3>Основные сведения</h3>
          <Badge tone={test.status === "published" ? "green" : "gray"}>
            {testStatusLabels[test.status]}
          </Badge>
        </div>
        <div className="form-grid">
          <Field label="Название теста" required>
            <input
              value={test.title}
              maxLength={200}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="Например, основы государственного аудита"
            />
          </Field>
          <Field
            label="Описание"
            hint="Сотрудник увидит описание перед началом теста."
          >
            <textarea
              value={test.description}
              rows={3}
              maxLength={3000}
              onChange={(event) => update({ description: event.target.value })}
            />
          </Field>
        </div>
      </section>
      <section className="panel">
        <h3>Правила прохождения</h3>
        <div
          className="form-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}
        >
          <Field label="Проходной результат, %" required>
            <input
              type="number"
              min={1}
              max={100}
              value={test.passPercent}
              onChange={(event) =>
                update({ passPercent: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Время, минут" hint="0 — без ограничения времени">
            <input
              type="number"
              min={0}
              max={1440}
              value={test.timeLimitMinutes}
              onChange={(event) =>
                update({ timeLimitMinutes: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Количество попыток" hint="0 — без ограничения попыток">
            <input
              type="number"
              min={0}
              max={100}
              value={test.maxAttempts}
              onChange={(event) =>
                update({ maxAttempts: Number(event.target.value) })
              }
            />
          </Field>
          <Field
            label="Вопросов в одной попытке"
            hint="0 — все вопросы из теста"
          >
            <input
              type="number"
              min={0}
              max={test.questions.length}
              value={test.questionLimit}
              onChange={(event) =>
                update({ questionLimit: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <div
          className="form-grid"
          style={{
            marginTop: 20,
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          }}
        >
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={test.shuffleQuestions}
              onChange={(event) =>
                update({ shuffleQuestions: event.target.checked })
              }
            />
            Перемешивать вопросы
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={test.shuffleAnswers}
              onChange={(event) =>
                update({ shuffleAnswers: event.target.checked })
              }
            />
            Перемешивать варианты ответов
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={test.showAnswers}
              onChange={(event) =>
                update({ showAnswers: event.target.checked })
              }
            />
            Показывать правильные ответы после завершения
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={test.showHistory}
              onChange={(event) =>
                update({ showHistory: event.target.checked })
              }
            />
            Показывать сотруднику историю попыток
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={test.allowNegativeMarking}
              onChange={(event) =>
                update({ allowNegativeMarking: event.target.checked })
              }
            />
            Штрафовать за неверные ответы
          </label>
          {test.allowNegativeMarking && (
            <Field
              label="Штраф за неверный ответ, баллов"
              hint="Итоговый результат не опускается ниже нуля."
            >
              <input
                type="number"
                min={0.01}
                step={0.25}
                value={test.negativePoints}
                onChange={(event) =>
                  update({ negativePoints: Number(event.target.value) })
                }
              />
            </Field>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>Вопросы теста</h3>
            <p className="muted">
              {test.questions.length} вопросов · {totalPoints} баллов в банке
              вопросов
            </p>
          </div>
          <div className="actions" style={{ flexWrap: "wrap" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadQuestionTemplate("csv")}
            >
              Шаблон CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadQuestionTemplate("json")}
            >
              Шаблон JSON
            </Button>
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => inputRef.current?.click()}
            >
              {importing ? "Импорт…" : "Импорт вопросов"}
            </Button>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept=".csv,.json"
              aria-label="Файл с вопросами"
              onChange={(event) => void onImport(event.target.files?.[0])}
            />
          </div>
        </div>
        <p className="muted">
          JSON или CSV, до 5 МБ. В CSV разделяйте варианты и номера правильных
          ответов символом |. Импортированные вопросы добавляются к
          существующим.
        </p>
      </section>
      {test.questions.map((question, index) => (
        <section className="panel" key={question.id}>
          <div className="section-heading">
            <h3>Вопрос {index + 1}</h3>
            <div className="actions">
              <Button
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => {
                  const questions = [...test.questions];
                  [questions[index - 1], questions[index]] = [
                    questions[index],
                    questions[index - 1],
                  ];
                  update({ questions });
                }}
              >
                Выше
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={index === test.questions.length - 1}
                onClick={() => {
                  const questions = [...test.questions];
                  [questions[index + 1], questions[index]] = [
                    questions[index],
                    questions[index + 1],
                  ];
                  update({ questions });
                }}
              >
                Ниже
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemoveId(question.id)}
              >
                Удалить
              </Button>
            </div>
          </div>
          <div
            className="form-grid"
            style={{ gridTemplateColumns: "minmax(0,1fr) 160px" }}
          >
            <Field label="Тип вопроса">
              <select
                value={question.type}
                onChange={(event) =>
                  changeType(question, event.target.value as QuestionType)
                }
              >
                {Object.entries(questionTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Баллы за ответ">
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={question.points}
                onChange={(event) =>
                  updateQuestion(question.id, {
                    points: Number(event.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field label="Текст вопроса" required>
            <textarea
              rows={2}
              maxLength={10000}
              value={question.text}
              onChange={(event) =>
                updateQuestion(question.id, { text: event.target.value })
              }
              placeholder="Введите вопрос"
            />
          </Field>
          {(question.type === "single" || question.type === "multiple") && (
            <div style={{ margin: "18px 0" }}>
              <p className="muted">
                Отметьте{" "}
                {question.type === "single"
                  ? "один правильный ответ"
                  : "все правильные ответы"}
                .
              </p>
              {question.options.map((option, optionIndex) => (
                <div
                  key={option.id}
                  className="actions"
                  style={{ marginBottom: 10 }}
                >
                  <input
                    type={question.type === "single" ? "radio" : "checkbox"}
                    name={`correct-${question.id}`}
                    aria-label={`Правильный вариант ${optionIndex + 1} вопроса ${index + 1}`}
                    checked={question.correctAnswers.includes(option.id)}
                    onChange={(event) =>
                      updateQuestion(question.id, {
                        correctAnswers:
                          question.type === "single"
                            ? [option.id]
                            : event.target.checked
                              ? [...question.correctAnswers, option.id]
                              : question.correctAnswers.filter(
                                  (id) => id !== option.id,
                                ),
                      })
                    }
                  />
                  <input
                    aria-label={`Вариант ${optionIndex + 1} вопроса ${index + 1}`}
                    value={option.text}
                    placeholder={`Вариант ${optionIndex + 1}`}
                    style={{ flex: 1 }}
                    onChange={(event) =>
                      updateQuestion(question.id, {
                        options: question.options.map((item) =>
                          item.id === option.id
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Удалить вариант ${optionIndex + 1}`}
                    disabled={question.options.length <= 2}
                    onClick={() =>
                      updateQuestion(question.id, {
                        options: question.options.filter(
                          (item) => item.id !== option.id,
                        ),
                        correctAnswers: question.correctAnswers.filter(
                          (id) => id !== option.id,
                        ),
                      })
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQuestion(question.id, {
                    options: [
                      ...question.options,
                      { id: newTestId("o"), text: "" },
                    ],
                  })
                }
              >
                + Вариант ответа
              </Button>
            </div>
          )}
          {question.type === "text" && (
            <Field
              label="Допустимые ответы"
              hint="Каждый допустимый ответ — с новой строки. Регистр букв и пробелы по краям не учитываются."
            >
              <textarea
                rows={3}
                value={question.correctAnswers.join("\n")}
                onChange={(event) =>
                  updateQuestion(question.id, {
                    correctAnswers: event.target.value.split("\n"),
                  })
                }
              />
            </Field>
          )}
          {question.type === "open" && (
            <p className="notice">
              Развёрнутый ответ проверяет кадровая служба. До проверки попытка
              будет иметь статус «На проверке».
            </p>
          )}
          <Field
            label={
              question.type === "open"
                ? "Критерии проверки"
                : "Пояснение к правильному ответу"
            }
            hint={
              question.type === "open"
                ? "Помогут кадровой службе оценить ответ."
                : "Отображается в результате, если включён показ правильных ответов."
            }
          >
            <textarea
              rows={2}
              value={question.explanation ?? ""}
              onChange={(event) =>
                updateQuestion(question.id, { explanation: event.target.value })
              }
            />
          </Field>
        </section>
      ))}
      <div className="actions">
        <Button
          variant="outline"
          onClick={() =>
            update({ questions: [...test.questions, newQuestion()] })
          }
        >
          + Добавить вопрос
        </Button>
        <span className="muted">
          {dirty ? "Есть несохранённые изменения" : "Изменения сохранены"}
        </span>
      </div>
      <div className="panel actions" style={{ justifyContent: "flex-end" }}>
        <Button
          variant="outline"
          onClick={() => (dirty ? setLeave(true) : navigate("/tests"))}
        >
          Отмена
        </Button>
        <Button
          onClick={() =>
            save(test.status === "published" ? "published" : "draft")
          }
        >
          Сохранить тест
        </Button>
      </div>
      <Modal
        open={Boolean(removeId)}
        title="Удалить вопрос?"
        onClose={() => setRemoveId(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveId(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                update({
                  questions: test.questions.filter(
                    (question) => question.id !== removeId,
                  ),
                });
                setRemoveId(null);
              }}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p>
          Вопрос будет удалён из этого теста после сохранения. Завершённые
          попытки сохранят прежнюю версию вопроса.
        </p>
      </Modal>
      <Modal
        open={leave}
        title="Есть несохранённые изменения"
        onClose={() => setLeave(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setLeave(false)}>
              Продолжить редактирование
            </Button>
            <Button variant="danger" onClick={() => navigate("/tests")}>
              Выйти без сохранения
            </Button>
          </>
        }
      >
        <p>Вернуться к списку тестов и не сохранять текущие изменения?</p>
      </Modal>
    </div>
  );
}
