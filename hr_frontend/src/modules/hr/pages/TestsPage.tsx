import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeading,
} from "../../../components/ui";
import type { Test } from "../../../api/types";
import { useHr } from "../../../store/HrContext";
import { newTestId, testStatusLabels } from "../components/TestsUtils";

export default function TestsPage() {
  const { state, role, saveTest } = useHr();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [archive, setArchive] = useState<Test | null>(null);
  const [error, setError] = useState("");
  const tests = useMemo(
    () =>
      state.tests.filter(
        (test) =>
          test.title.toLowerCase().includes(search.toLowerCase()) &&
          (status === "all" || status === "active"
            ? status === "all" || test.status !== "archived"
            : test.status === status),
      ),
    [state.tests, search, status],
  );
  if (role !== "hr")
    return (
      <div className="page">
        <PageHeading
          title="Тесты"
          subtitle="Тестирование доступно в назначенных вам курсах."
        />
        <Link className="btn btn-primary" to="/my-learning">
          Перейти к моему обучению
        </Link>
      </div>
    );
  function clone(test: Test) {
    try {
      const id = saveTest({
        ...test,
        id: newTestId("test"),
        title: `${test.title} — копия`,
        status: "draft",
        questions: test.questions.map((question) => ({
          ...question,
          options: question.options.map((option) => ({ ...option })),
          correctAnswers: [...question.correctAnswers],
        })),
      });
      navigate(`/tests/${id}/edit`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function confirmArchive() {
    if (!archive) return;
    try {
      saveTest({ ...archive, status: "archived" });
      setArchive(null);
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
      setArchive(null);
    }
  }
  return (
    <div className="page">
      <PageHeading
        title="Тесты и вопросы"
        subtitle="Создавайте тесты, задавайте правила оценки и связывайте их с курсами."
        action={
          <Button onClick={() => navigate("/tests/new")}>+ Создать тест</Button>
        }
      />
      <div
        className="cards"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
          gap: 16,
        }}
      >
        <div className="panel">
          <span className="muted">Опубликовано</span>
          <h2>
            {state.tests.filter((test) => test.status === "published").length}
          </h2>
          <span className="muted">Готовы для обучения</span>
        </div>
        <div className="panel">
          <span className="muted">Вопросов в базе</span>
          <h2>
            {state.tests
              .filter((test) => test.status !== "archived")
              .reduce((sum, test) => sum + test.questions.length, 0)}
          </h2>
          <span className="muted">В действующих тестах</span>
        </div>
        <div className="panel">
          <span className="muted">Ожидают проверки</span>
          <h2>
            {
              state.attempts.filter(
                (attempt) => attempt.status === "pending_review",
              ).length
            }
          </h2>
          <Link to="/results">Проверить ответы →</Link>
        </div>
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="toolbar">
          <input
            aria-label="Поиск теста"
            placeholder="Поиск по названию теста"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ minWidth: 240 }}
          />
          <select
            aria-label="Статус теста"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="active">Действующие тесты</option>
            <option value="published">Опубликованные</option>
            <option value="draft">Черновики</option>
            <option value="archived">Архив</option>
            <option value="all">Все статусы</option>
          </select>
          <span className="muted">Найдено: {tests.length}</span>
        </div>
        {tests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Название теста</th>
                  <th>Вопросы</th>
                  <th>Правила прохождения</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr key={test.id}>
                    <td>
                      <Link to={`/tests/${test.id}/edit`}>
                        <strong>{test.title}</strong>
                      </Link>
                      <div
                        className="muted"
                        style={{ maxWidth: 420, marginTop: 5 }}
                      >
                        {test.description}
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        Курсов:{" "}
                        {
                          state.courses.filter(
                            (course) => course.testId === test.id,
                          ).length
                        }
                      </div>
                    </td>
                    <td>
                      {test.questions.length}
                      <div className="muted">
                        {
                          test.questions.filter(
                            (question) => question.type === "open",
                          ).length
                        }{" "}
                        с ручной проверкой
                      </div>
                    </td>
                    <td>
                      <strong>От {test.passPercent}%</strong>
                      <div className="muted">
                        {test.timeLimitMinutes
                          ? `${test.timeLimitMinutes} мин`
                          : "Без ограничения времени"}{" "}
                        ·{" "}
                        {test.maxAttempts
                          ? `${test.maxAttempts} попытки`
                          : "Попытки без ограничений"}
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          test.status === "published"
                            ? "green"
                            : test.status === "archived"
                              ? "gray"
                              : "amber"
                        }
                      >
                        {testStatusLabels[test.status]}
                      </Badge>
                    </td>
                    <td>
                      <div className="actions" style={{ flexWrap: "wrap" }}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/tests/${test.id}/edit`)}
                        >
                          Открыть
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => clone(test)}
                        >
                          Копия
                        </Button>
                        {test.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setArchive(test)}
                          >
                            В архив
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Тесты не найдены"
            description="Измените фильтры или создайте первый тест."
          />
        )}
      </section>
      <Modal
        open={Boolean(archive)}
        title="Перенести тест в архив?"
        onClose={() => setArchive(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setArchive(null)}>
              Отмена
            </Button>
            <Button onClick={confirmArchive}>В архив</Button>
          </>
        }
      >
        <p>
          Тест «{archive?.title}» останется в истории результатов. Новые
          прохождения архивного теста будут недоступны.
        </p>
        {archive &&
          state.courses.some((course) => course.testId === archive.id) && (
            <p className="muted">
              Тест связан с курсами. При необходимости выберите для них другой
              итоговый тест.
            </p>
          )}
      </Modal>
    </div>
  );
}
