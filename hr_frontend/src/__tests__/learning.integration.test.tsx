// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import type { HrState, Question, Role } from "../api/types";
import { STATE_KEY, persistState } from "../api/storage";
import { HrProvider, useHr } from "../store/HrContext";
import AssignmentsPage from "../modules/hr/pages/AssignmentsPage";
import CourseDetailPage from "../modules/hr/pages/CourseDetailPage";
import MyLearningPage from "../modules/hr/pages/MyLearningPage";
import TestPlayerPage from "../modules/hr/pages/TestPlayerPage";
import ResultsPage from "../modules/hr/pages/ResultsPage";
import TestEditorPage from "../modules/hr/pages/TestEditorPage";
import App from "../App";

const choice: Question = {
  id: "knowledge",
  type: "single",
  text: "Кто назначает обучение?",
  options: [
    { id: "hr", text: "Кадровая служба" },
    { id: "external", text: "Внешний посетитель" },
  ],
  correctAnswers: ["hr"],
  points: 2,
};

function fixture(questions: Question[] = [choice]): HrState {
  return {
    version: 1,
    employees: [
      {
        id: "employee-a",
        name: "Тестовая Айгуль",
        email: "a@example.test",
        department: "Департамент аудита",
        position: "Аудитор",
        status: "active",
      },
      {
        id: "employee-b",
        name: "Тестовый Бекзат",
        email: "b@example.test",
        department: "Контроль качества",
        position: "Эксперт",
        status: "active",
      },
    ],
    courses: [
      {
        id: "orientation",
        title: "Вводное обучение SAQ",
        description: "Изучение процесса обучения сотрудников.",
        category: "Адаптация",
        durationHours: 2,
        status: "published",
        updatedAt: new Date().toISOString(),
        testId: "assessment",
        certificateEnabled: true,
        allowSelfEnrollment: false,
        chapters: [
          {
            id: "basics",
            title: "Основы",
            lessons: [
              {
                id: "lesson-1",
                title: "Работа с назначениями",
                type: "text",
                content:
                  "Сотрудник проходит назначенные кадровой службой курсы.",
                durationMinutes: 10,
              },
              {
                id: "lesson-2",
                title: "Итоговая проверка",
                type: "text",
                content: "Результаты теста доступны кадровой службе.",
                durationMinutes: 10,
              },
            ],
          },
        ],
      },
    ],
    tests: [
      {
        id: "assessment",
        title: "Проверка знаний SAQ",
        description: "Итоговый тест",
        questions,
        timeLimitMinutes: 20,
        passPercent: 70,
        maxAttempts: 2,
        shuffleQuestions: false,
        shuffleAnswers: false,
        allowNegativeMarking: false,
        status: "published",
        showAnswers: true,
        showHistory: true,
        negativePoints: 0.25,
        questionLimit: 0,
      },
    ],
    assignments: [],
    attempts: [],
    programs: [],
    notifications: [],
    resources: [],
    reviews: [],
    settings: {
      organizationName: "SAQ",
      certificatePrefix: "SAQ-HR",
      defaultPassPercent: 70,
      defaultTimeLimitMinutes: 20,
      defaultMaxAttempts: 2,
      notificationDaysBefore: 3,
    },
  };
}

let context: ReturnType<typeof useHr>;
function SessionControls() {
  context = useHr();
  const navigate = useNavigate();
  return (
    <nav aria-label="Тестовый сеанс">
      <label>
        Тестовая роль
        <select
          value={context.role}
          onChange={(event) => {
            context.setRole(event.target.value as Role);
            navigate(
              event.target.value === "employee"
                ? "/my-learning"
                : "/assignments",
            );
          }}
        >
          <option value="hr">Кадры</option>
          <option value="employee">Сотрудник</option>
        </select>
      </label>
      <label>
        Тестовый сотрудник
        <select
          value={context.employeeId}
          onChange={(event) => context.setEmployeeId(event.target.value)}
        >
          {context.state.employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={() => navigate("/results")}>Журнал результатов</button>
    </nav>
  );
}
function mount(path = "/assignments") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HrProvider>
        <SessionControls />
        <Routes>
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/my-learning" element={<MyLearningPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/tests/new" element={<TestEditorPage />} />
          <Route path="/tests/:id/edit" element={<TestEditorPage />} />
          <Route path="/tests/:id/take" element={<TestPlayerPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="*" element={<p>Неизвестный маршрут</p>} />
        </Routes>
      </HrProvider>
    </MemoryRouter>,
  );
}
function storeFixture(state = fixture(), role: Role = "hr") {
  expect(persistState(state)).toBeNull();
  localStorage.setItem(
    "saq-hr-ui:v1",
    JSON.stringify({ role, employeeId: "employee-a" }),
  );
}
function assignedFixture(questions?: Question[]) {
  const state = fixture(questions);
  state.assignments.push({
    id: "assignment-a",
    employeeId: "employee-a",
    courseId: "orientation",
    assignedAt: new Date().toISOString(),
    deadline: "2099-12-31",
    required: true,
    completedLessonIds: ["lesson-1", "lesson-2"],
  });
  return state;
}
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Обучение: кадровая служба → сотрудник → результаты", () => {
  it("назначает курс выбранному сотруднику, сохраняет изучение и ответы при перезагрузке, показывает кадровой службе итог", async () => {
    storeFixture();
    const user = userEvent.setup();
    let view = mount();
    await user.click(
      screen.getAllByRole("button", { name: "Назначить обучение" })[0],
    );
    const dialog = screen.getByRole("dialog", { name: "Назначить обучение" });
    await user.click(
      within(dialog).getByRole("checkbox", { name: /Тестовая Айгуль/ }),
    );
    await user.click(
      within(dialog).getByRole("checkbox", { name: /Вводное обучение SAQ/ }),
    );
    fireEvent.change(within(dialog).getByLabelText(/Пройти до/), {
      target: { value: "2099-12-31" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Назначить · 1" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const assignedRow = screen.getByRole("row", {
      name: /Тестовая Айгуль.*Вводное обучение SAQ/,
    });
    expect(within(assignedRow).getByText("Не начат")).toBeTruthy();
    expect(screen.queryByRole("row", { name: /Тестовый Бекзат/ })).toBeNull();

    await user.selectOptions(
      screen.getByLabelText("Тестовая роль"),
      "employee",
    );
    await user.click(
      screen.getByRole("link", { name: "Вводное обучение SAQ" }),
    );
    expect(screen.queryByRole("link", { name: "Начать тест" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: /Работа с назначениями/ }),
    );
    expect(
      screen.getByText(
        "Сотрудник проходит назначенные кадровой службой курсы.",
      ),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Изучено, продолжить" }),
    );

    // Remount the real provider to model closing and reopening the browser page.
    view.unmount();
    view = mount("/courses/orientation");
    expect(screen.getByText(/Изучено материалов: 1 из 2/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Итоговая проверка/ }));
    await user.click(
      screen.getByRole("button", { name: "Изучено, продолжить" }),
    );
    await user.click(screen.getByRole("link", { name: "Начать тест" }));
    await user.click(screen.getByRole("button", { name: "Начать тест" }));
    await user.click(screen.getByRole("radio", { name: "Кадровая служба" }));
    const originalDeadline = context.state.attempts[0].expiresAt;

    view.unmount();
    view = mount(
      `/tests/assessment/take?assignment=${context.state.assignments[0].id}`,
    );
    expect(
      (
        screen.getByRole("radio", {
          name: "Кадровая служба",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(context.state.attempts[0].expiresAt).toBe(originalDeadline);
    await user.click(screen.getByRole("button", { name: "Завершить тест" }));
    await user.click(
      screen.getByRole("button", { name: "Завершить и отправить" }),
    );
    expect(
      screen.getByRole("heading", { name: "Тест успешно сдан" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Вернуться к курсу" }));
    expect(screen.getByText(/Обучение завершено/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Сертификат" })).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Тестовая роль"), "hr");
    const finishedRow = screen.getByRole("row", {
      name: /Тестовая Айгуль.*Вводное обучение SAQ/,
    });
    expect(within(finishedRow).getByText("Завершён")).toBeTruthy();
    expect(within(finishedRow).getAllByText("100%").length).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("button", { name: "Журнал результатов" }),
    );
    expect(
      screen.getByRole("row", {
        name: /Тестовая Айгуль.*Проверка знаний SAQ.*100%.*Сдан/,
      }),
    ).toBeTruthy();
    expect(context.storageError).toBeNull();
    view.unmount();
    mount("/assignments");
    expect(
      screen.getByRole("row", { name: /Тестовая Айгуль.*Завершён/ }),
    ).toBeTruthy();
  });

  it("ожидает проверки развёрнутого ответа и завершает курс только после оценки кадровой службой", async () => {
    const openQuestion: Question = {
      id: "reflection",
      type: "open",
      text: "Опишите процесс проверки знаний.",
      options: [],
      correctAnswers: [],
      points: 4,
    };
    storeFixture(assignedFixture([openQuestion]), "employee");
    const user = userEvent.setup();
    mount("/tests/assessment/take?assignment=assignment-a");
    await user.click(screen.getByRole("button", { name: "Начать тест" }));
    await user.type(
      screen.getByLabelText(/Ваш развёрнутый ответ/),
      "Изучаю материалы, сдаю тест, получаю обратную связь.",
    );
    await user.click(screen.getByRole("button", { name: "Завершить тест" }));
    await user.click(
      screen.getByRole("button", { name: "Завершить и отправить" }),
    );
    expect(
      screen.getByRole("heading", { name: "Ответы переданы на проверку" }),
    ).toBeTruthy();
    expect(context.state.assignments[0].completedAt).toBeUndefined();
    await user.selectOptions(screen.getByLabelText("Тестовая роль"), "hr");
    await user.click(
      screen.getByRole("button", { name: "Журнал результатов" }),
    );
    await user.click(screen.getByRole("button", { name: "Проверить" }));
    await user.click(
      screen.getByRole("button", { name: "Завершить проверку" }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Оцените каждый развёрнутый ответ",
    );
    fireEvent.change(screen.getByLabelText(/Балл \(0–4\)/), {
      target: { value: "4" },
    });
    await user.type(
      screen.getByLabelText("Комментарий сотруднику"),
      "Последовательность описана верно.",
    );
    await user.click(
      screen.getByRole("button", { name: "Завершить проверку" }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Проверка завершена",
    );
    expect(context.state.assignments[0].completedAt).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Закрыть$/ }));
    await user.selectOptions(
      screen.getByLabelText("Тестовая роль"),
      "employee",
    );
    await user.click(screen.getByRole("button", { name: /Завершённые/ }));
    expect(
      screen.getByRole("link", { name: "Вводное обучение SAQ" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Журнал результатов" }),
    );
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(
      screen.getByText(
        /Комментарий проверяющего: Последовательность описана верно/,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Завершить проверку" }),
    ).toBeNull();
  });

  it("не позволяет сотруднику менять кадровые данные или проходить чужое назначение", async () => {
    const state = assignedFixture();
    state.assignments.push({
      ...state.assignments[0],
      id: "assignment-b",
      employeeId: "employee-b",
    });
    storeFixture(state, "employee");
    mount("/tests/assessment/take?assignment=assignment-b");
    expect(screen.getByText("Тест не назначен")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Начать тест" })).toBeNull();
    expect(() =>
      context.saveTest({ ...state.tests[0], title: "Подмена" }),
    ).toThrow(/кадровой службе/);
    expect(() =>
      context.assignCourses({
        employeeIds: ["employee-a"],
        courseIds: ["orientation"],
        deadline: "2099-12-31",
      }),
    ).toThrow(/кадровой службе/);
    expect(() => context.beginAttempt("assignment-b")).toThrow(
      /выбранного сотрудника/,
    );
    expect(() => context.completeLesson("assignment-b", "lesson-1")).toThrow(
      /выбранного сотрудника/,
    );
    expect(() =>
      context.updateSettings({ certificatePrefix: "Изменён" }),
    ).toThrow(/кадровой службе/);
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!).tests[0].title).toBe(
      "Проверка знаний SAQ",
    );
    act(() => {
      context.setRole("hr");
      context.setEmployeeId("employee-b");
    });
    expect(screen.getByText("Переключитесь на роль сотрудника")).toBeTruthy();
  });

  it("закрывает кадровые маршруты сотруднику и открывает их после переключения реальной роли в приложении", async () => {
    storeFixture(assignedFixture(), "employee");
    const user = userEvent.setup();
    for (const path of ["/assignments", "/tests/new", "/settings"]) {
      window.history.replaceState({}, "", path);
      const page = render(<App />);
      await screen.findByRole("heading", { name: "Моё обучение", level: 2 });
      expect(window.location.pathname).toBe("/my-learning");
      expect(screen.queryByRole("link", { name: "Назначения" })).toBeNull();
      expect(
        screen.queryByRole("link", { name: "Тесты и вопросы" }),
      ).toBeNull();
      expect(screen.queryByRole("link", { name: "Настройки" })).toBeNull();
      page.unmount();
    }
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Режим просмотра"), "hr");
    await user.click(screen.getByRole("link", { name: "Назначения" }));
    await screen.findByRole("heading", { name: "Назначения на обучение" });
    expect(
      screen.getByRole("button", { name: "Назначить обучение" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("row", {
        name: /Тестовая Айгуль.*Вводное обучение SAQ/,
      }),
    ).toBeTruthy();
  });
});

describe("Импорт вопросов в редакторе", () => {
  function jsonFile(contents: string, name = "questions.json") {
    const file = new File([contents], name, {
      type: name.endsWith(".csv") ? "text/csv" : "application/json",
    });
    // jsdom does not implement Blob.text; supplying it preserves real import parsing.
    Object.defineProperty(file, "text", { value: async () => contents });
    return file;
  }
  it("отклоняет неверный файл без потери редактора, затем импортирует и сохраняет валидные вопросы", async () => {
    storeFixture();
    const user = userEvent.setup();
    mount("/tests/new");
    await user.type(
      screen.getByLabelText(/Название теста/),
      "Импортированный экзамен",
    );
    const fileInput = screen.getByLabelText("Файл с вопросами");
    await user.upload(
      fileInput,
      jsonFile(
        '[{"type":"single","text":"Некорректный вопрос","options":["Да","Нет"],"correctAnswers":["9"]}]',
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "не найден среди вариантов",
      ),
    );
    expect(
      (screen.getByLabelText(/Название теста/) as HTMLInputElement).value,
    ).toBe("Импортированный экзамен");
    expect(screen.queryByDisplayValue("Некорректный вопрос")).toBeNull();
    await user.upload(
      fileInput,
      jsonFile(
        "type;question;options;correct;points;explanation\r\nsingle;Кто назначает курс?;Кадры|Гость;1;2;Назначает кадровая служба\r\ntext;Название системы;;;1;",
        "questions.csv",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "допустимый короткий ответ",
      ),
    );
    expect(screen.queryByDisplayValue("Кто назначает курс?")).toBeNull();
    await user.upload(
      fileInput,
      jsonFile(
        JSON.stringify({
          questions: [
            {
              type: "single",
              text: "Кто назначает курс?",
              options: ["Кадры", "Гость"],
              correctAnswers: ["1"],
              points: 2,
            },
            {
              type: "text",
              text: "Название системы?",
              correctAnswers: ["SAQ", "САК"],
              points: 1,
            },
          ],
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Импортировано вопросов: 2",
      ),
    );
    expect(screen.getByDisplayValue("Кто назначает курс?")).toBeTruthy();
    expect(screen.getByDisplayValue("Название системы?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(
      screen.getByRole("heading", { name: "Редактирование теста" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    const saved = context.state.tests.find(
      (test) => test.title === "Импортированный экзамен",
    );
    expect(saved?.status).toBe("published");
    expect(
      saved?.questions[0].options.find(
        (option) => option.id === saved.questions[0].correctAnswers[0],
      )?.text,
    ).toBe("Кадры");
    expect(context.storageError).toBeNull();
  });
});
