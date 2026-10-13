import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Answers,
  AssignCoursesInput,
  Assignment,
  Attempt,
  Course,
  CourseReview,
  Employee,
  HrSettings,
  HrState,
  Notification,
  Program,
  Resource,
  ReviewInput,
  Role,
  Test,
} from "../api/types";
import { loadState, persistState } from "../api/storage";
import { createSeedState } from "../data/seed";
import {
  applyReview,
  createId,
  getAssignmentProgress,
  getCourseLessons,
  gradeAttempt,
  isSafeUrl,
  makeAttempt,
  normalizeAnswers,
  reconcileCompletions,
  validDate,
  validateCourse,
  validateTest,
} from "./hrDomain";

interface HrContextValue {
  state: HrState;
  role: Role;
  employeeId: string;
  storageError: string | null;
  setRole: (role: Role) => void;
  setEmployeeId: (id: string) => void;
  saveReview: (review: CourseReview) => string;
  saveEmployee: (employee: Employee) => string;
  saveCourse: (course: Course) => string;
  saveTest: (test: Test) => string;
  saveProgram: (program: Program) => string;
  saveResource: (resource: Resource) => string;
  archiveCourse: (id: string) => void;
  archiveProgram: (id: string) => void;
  deleteTest: (id: string) => void;
  deleteResource: (id: string) => void;
  assignCourses: (input: AssignCoursesInput) => number;
  enrollCourse: (courseId: string) => string;
  changeAssignmentDeadline: (id: string, deadline: string) => void;
  cancelAssignment: (id: string) => void;
  completeLesson: (assignmentId: string, lessonId: string) => void;
  beginAttempt: (assignmentId: string) => Attempt;
  saveAttemptAnswers: (attemptId: string, answers: Answers) => void;
  submitAttempt: (attemptId: string, answers?: Answers) => Attempt;
  reviewAttempt: (attemptId: string, review: ReviewInput) => Attempt;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateSettings: (settings: Partial<HrSettings>) => void;
  resetDemo: () => void;
}
const HrContext = createContext<HrContextValue | null>(null);
function upsert<T extends { id: string }>(items: T[], item: T) {
  return items.some((row) => row.id === item.id)
    ? items.map((row) => (row.id === item.id ? item : row))
    : [...items, item];
}
function uiSession(): { role: Role; employeeId: string } {
  try {
    const value = JSON.parse(localStorage.getItem("saq-hr-ui:v1") ?? "{}");
    return {
      role: value.role === "employee" ? "employee" : "hr",
      employeeId:
        typeof value.employeeId === "string" ? value.employeeId : "employee-1",
    };
  } catch {
    return { role: "hr", employeeId: "employee-1" };
  }
}
export function HrProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadState(createSeedState));
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  const [storageError, setStorageError] = useState<string | null>(
    initial.error,
  );
  const [session] = useState(uiSession);
  const [role, setRoleValue] = useState<Role>(session.role);
  const [employeeId, setEmployeeIdValue] = useState(
    initial.state.employees.some((e) => e.id === session.employeeId)
      ? session.employeeId
      : (initial.state.employees[0]?.id ?? "employee-1"),
  );
  const roleRef = useRef(role);
  const employeeRef = useRef(employeeId);
  const setRole = (next: Role) => {
    if (!["hr", "employee"].includes(next))
      throw new Error("Неизвестная роль.");
    roleRef.current = next;
    setRoleValue(next);
  };
  const setEmployeeId = (id: string) => {
    if (!stateRef.current.employees.some((e) => e.id === id))
      throw new Error("Сотрудник не найден.");
    employeeRef.current = id;
    setEmployeeIdValue(id);
  };
  useEffect(() => {
    try {
      localStorage.setItem(
        "saq-hr-ui:v1",
        JSON.stringify({ role, employeeId }),
      );
    } catch {
      /* Main data writes report storage failures. */
    }
  }, [role, employeeId]);
  const commit = (next: HrState): HrState => {
    const reconciled = reconcileCompletions(next);
    stateRef.current = reconciled;
    setState(reconciled);
    setStorageError(persistState(reconciled));
    return reconciled;
  };
  const requireHr = () => {
    if (roleRef.current !== "hr")
      throw new Error("Действие доступно кадровой службе.");
  };
  const requireOwner = (owner: string) => {
    if (owner !== employeeRef.current)
      throw new Error(
        "Можно проходить обучение только от имени выбранного сотрудника.",
      );
    if (
      !stateRef.current.employees.some(
        (e) => e.id === owner && e.status === "active",
      )
    )
      throw new Error("Учётная запись сотрудника неактивна.");
  };
  const assignmentFor = (id: string) => {
    const item = stateRef.current.assignments.find(
      (a) => a.id === id && !a.cancelledAt,
    );
    if (!item) throw new Error("Действующее назначение не найдено.");
    return item;
  };
  const attemptFor = (id: string) => {
    const item = stateRef.current.attempts.find((a) => a.id === id);
    if (!item) throw new Error("Попытка не найдена.");
    return item;
  };
  const notification = (
    item: Omit<Notification, "id" | "createdAt" | "read">,
  ): Notification => ({
    ...item,
    id: createId("notification"),
    createdAt: new Date().toISOString(),
    read: false,
  });
  const withAttempt = (nextAttempt: Attempt) => {
    const old = stateRef.current;
    let notifications = old.notifications;
    const previous = old.attempts.find((a) => a.id === nextAttempt.id);
    if (
      previous?.status !== nextAttempt.status &&
      nextAttempt.status !== "in_progress"
    ) {
      const pending = nextAttempt.status === "pending_review";
      notifications = [
        ...notifications,
        notification({
          employeeId: nextAttempt.employeeId,
          audience: "employee",
          title: pending
            ? "Тест отправлен на проверку"
            : nextAttempt.status === "passed"
              ? "Тест успешно пройден"
              : "Тест не пройден",
          message: `${nextAttempt.testSnapshot.title}: ${pending ? "ожидает оценки открытых ответов" : `${nextAttempt.percent}%`}.`,
          type: "result",
          href: "/my-learning",
        }),
      ];
      if (pending)
        notifications = [
          ...notifications,
          notification({
            audience: "hr",
            title: "Открытый ответ ожидает проверки",
            message: `${nextAttempt.testSnapshot.title}: поступила попытка № ${nextAttempt.number}.`,
            type: "result",
            href: "/results",
          }),
        ];
    }
    commit({
      ...old,
      attempts: upsert(old.attempts, nextAttempt),
      notifications,
    });
  };
  // A reload keeps the original expiresAt. Expired attempts are finalized from already saved answers.
  useEffect(() => {
    const finishExpired = () => {
      const expired = stateRef.current.attempts.filter(
        (a) =>
          a.status === "in_progress" && Date.parse(a.expiresAt) <= Date.now(),
      );
      for (const attempt of expired) withAttempt(gradeAttempt(attempt));
    };
    finishExpired();
    const timer = setInterval(finishExpired, 10_000);
    return () => clearInterval(timer);
  }, []);
  const saveReview = (input: CourseReview) => {
    requireOwner(input.employeeId);
    if (
      !stateRef.current.assignments.some(
        (a) =>
          a.employeeId === input.employeeId &&
          a.courseId === input.courseId &&
          !a.cancelledAt,
      )
    )
      throw new Error("Отзыв доступен только участникам курса.");
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      throw new Error("Выберите оценку от 1 до 5.");
    if (!input.text.trim()) throw new Error("Напишите текст отзыва.");
    const existing = stateRef.current.reviews.find(
      (r) => r.courseId === input.courseId && r.employeeId === input.employeeId,
    );
    const review = {
      ...input,
      id: existing?.id ?? createId("review"),
      text: input.text.trim().slice(0, 5000),
      createdAt: new Date().toISOString(),
    };
    commit({
      ...stateRef.current,
      reviews: upsert(stateRef.current.reviews, review),
    });
    return review.id;
  };
  const saveEmployee = (input: Employee) => {
    requireHr();
    const employee = {
      ...input,
      id: input.id || createId("employee"),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
    };
    if (
      !employee.name ||
      !employee.department.trim() ||
      !employee.position.trim()
    )
      throw new Error("Укажите ФИО, подразделение и должность.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email))
      throw new Error("Укажите корректный email.");
    if (
      stateRef.current.employees.some(
        (e) => e.id !== employee.id && e.email.toLowerCase() === employee.email,
      )
    )
      throw new Error("Сотрудник с таким email уже существует.");
    if (employee.hiredAt && !validDate(employee.hiredAt))
      throw new Error("Укажите корректную дату приёма.");
    if (
      employee.seniorityYears !== undefined &&
      (!Number.isFinite(employee.seniorityYears) || employee.seniorityYears < 0)
    )
      throw new Error("Стаж не может быть отрицательным.");
    employee.registeredAt ||= new Date().toISOString();
    commit({
      ...stateRef.current,
      employees: upsert(stateRef.current.employees, employee),
    });
    return employee.id;
  };
  const saveCourse = (input: Course) => {
    requireHr();
    const course = structuredClone({
      ...input,
      id: input.id || createId("course"),
      updatedAt: new Date().toISOString(),
    });
    validateCourse(course, stateRef.current);
    commit({
      ...stateRef.current,
      courses: upsert(stateRef.current.courses, course),
    });
    return course.id;
  };
  const saveTest = (input: Test) => {
    requireHr();
    const test = structuredClone({
      ...input,
      id: input.id || createId("test"),
    });
    validateTest(test);
    commit({
      ...stateRef.current,
      tests: upsert(stateRef.current.tests, test),
    });
    return test.id;
  };
  const saveProgram = (input: Program) => {
    requireHr();
    if (!input.title.trim()) throw new Error("Укажите название программы.");
    if (input.deadline && !validDate(input.deadline))
      throw new Error("Укажите корректный срок программы.");
    if (
      input.courseIds.some(
        (id) => !stateRef.current.courses.some((c) => c.id === id),
      ) ||
      input.employeeIds.some(
        (id) => !stateRef.current.employees.some((e) => e.id === id),
      )
    )
      throw new Error("Сотрудник или курс программы не найден.");
    const program = structuredClone({
      ...input,
      id: input.id || createId("program"),
      courseIds: [...new Set(input.courseIds)],
      employeeIds: [...new Set(input.employeeIds)],
    });
    if (program.status === "published" && !program.courseIds.length)
      throw new Error("Добавьте курсы в программу.");
    commit({
      ...stateRef.current,
      programs: upsert(stateRef.current.programs, program),
    });
    return program.id;
  };
  const saveResource = (input: Resource) => {
    requireHr();
    if (!input.title.trim()) throw new Error("Укажите название материала.");
    if (input.type === "link" && !isSafeUrl(input.url ?? ""))
      throw new Error("Укажите корректную http/https ссылку.");
    if (input.type === "file" && !input.fileId)
      throw new Error("Загрузите файл.");
    const resource = {
      ...input,
      id: input.id || createId("resource"),
      updatedAt: new Date().toISOString(),
    };
    commit({
      ...stateRef.current,
      resources: upsert(stateRef.current.resources, resource),
    });
    return resource.id;
  };
  const archiveCourse = (id: string) => {
    requireHr();
    const course = stateRef.current.courses.find((c) => c.id === id);
    if (!course) throw new Error("Курс не найден.");
    if (
      stateRef.current.assignments.some(
        (a) =>
          a.courseId === id &&
          !a.cancelledAt &&
          !getAssignmentProgress(stateRef.current, a).isComplete,
      )
    )
      throw new Error(
        "Сначала завершите или отмените действующие назначения курса.",
      );
    saveCourse({ ...course, status: "archived" });
  };
  const archiveProgram = (id: string) => {
    requireHr();
    const program = stateRef.current.programs.find((p) => p.id === id);
    if (!program) throw new Error("Программа не найдена.");
    saveProgram({ ...program, status: "archived" });
  };
  const deleteTest = (id: string) => {
    requireHr();
    const test = stateRef.current.tests.find((t) => t.id === id);
    if (!test) throw new Error("Тест не найден.");
    if (
      stateRef.current.courses.some(
        (c) => c.testId === id && c.status !== "archived",
      )
    )
      throw new Error(
        "Тест используется в курсе. Сначала измените итоговый тест курса.",
      );
    saveTest({ ...test, status: "archived" });
  };
  const deleteResource = (id: string) => {
    requireHr();
    commit({
      ...stateRef.current,
      resources: stateRef.current.resources.filter((r) => r.id !== id),
    });
  };
  const assign = (input: AssignCoursesInput): Assignment[] => {
    if (!input.employeeIds.length || !input.courseIds.length)
      throw new Error("Выберите сотрудников и курсы.");
    if (!validDate(input.deadline))
      throw new Error("Укажите корректный срок обучения.");
    const current = stateRef.current;
    const additions: Assignment[] = [];
    const notifications: Notification[] = [];
    for (const employeeId of new Set(input.employeeIds)) {
      if (
        !current.employees.some(
          (e) => e.id === employeeId && e.status === "active",
        )
      )
        throw new Error(
          "Назначать обучение можно только активным сотрудникам.",
        );
      for (const courseId of new Set(input.courseIds)) {
        const course = current.courses.find(
          (c) => c.id === courseId && c.status === "published",
        );
        if (!course)
          throw new Error("Назначать можно только опубликованные курсы.");
        if (
          current.assignments.some(
            (a) =>
              a.employeeId === employeeId &&
              a.courseId === courseId &&
              !a.cancelledAt,
          )
        )
          continue;
        additions.push({
          id: createId("assignment"),
          employeeId,
          courseId,
          assignedAt: new Date().toISOString(),
          deadline: input.deadline,
          required: input.required ?? true,
          completedLessonIds: [],
        });
        notifications.push(
          notification({
            employeeId,
            audience: "employee",
            title: "Назначен курс",
            message: `«${course.title}». Срок: ${input.deadline.split("-").reverse().join(".")}.`,
            type: "assignment",
            href: "/my-learning",
          }),
        );
      }
    }
    if (additions.length)
      commit({
        ...current,
        assignments: [...current.assignments, ...additions],
        notifications: [...current.notifications, ...notifications],
      });
    return additions;
  };
  const assignCourses = (input: AssignCoursesInput) => {
    requireHr();
    return assign(input).length;
  };
  const enrollCourse = (courseId: string) => {
    requireOwner(employeeRef.current);
    const course = stateRef.current.courses.find((c) => c.id === courseId);
    if (
      !course ||
      course.status !== "published" ||
      course.allowSelfEnrollment === false
    )
      throw new Error("Самостоятельная запись на этот курс недоступна.");
    const existing = stateRef.current.assignments.find(
      (a) =>
        a.courseId === courseId &&
        a.employeeId === employeeRef.current &&
        !a.cancelledAt,
    );
    if (existing) return existing.id;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    return assign({
      employeeIds: [employeeRef.current],
      courseIds: [courseId],
      deadline: deadline.toISOString().slice(0, 10),
      required: false,
    })[0].id;
  };
  const changeAssignmentDeadline = (id: string, deadline: string) => {
    requireHr();
    const assignment = assignmentFor(id);
    if (!validDate(deadline))
      throw new Error("Укажите корректный срок обучения.");
    if (getAssignmentProgress(stateRef.current, assignment).isComplete)
      throw new Error("Обучение уже завершено.");
    commit({
      ...stateRef.current,
      assignments: stateRef.current.assignments.map((a) =>
        a.id === id ? { ...a, deadline } : a,
      ),
      notifications: [
        ...stateRef.current.notifications,
        notification({
          audience: "employee",
          employeeId: assignment.employeeId,
          title: "Срок обучения изменён",
          message: `Новый срок: ${deadline.split("-").reverse().join(".")}.`,
          type: "deadline",
          href: "/my-learning",
        }),
      ],
    });
  };
  const cancelAssignment = (id: string) => {
    requireHr();
    const assignment = assignmentFor(id);
    if (getAssignmentProgress(stateRef.current, assignment).isComplete)
      throw new Error(
        "Завершённое обучение сохраняется в истории и не отменяется.",
      );
    if (
      stateRef.current.attempts.some(
        (a) =>
          a.assignmentId === id &&
          ["in_progress", "pending_review"].includes(a.status),
      )
    )
      throw new Error(
        "Сначала завершите или проверьте текущую попытку тестирования.",
      );
    commit({
      ...stateRef.current,
      assignments: stateRef.current.assignments.map((a) =>
        a.id === id ? { ...a, cancelledAt: new Date().toISOString() } : a,
      ),
    });
  };
  const completeLesson = (assignmentId: string, lessonId: string) => {
    const assignment = assignmentFor(assignmentId);
    requireOwner(assignment.employeeId);
    const course = stateRef.current.courses.find(
      (c) => c.id === assignment.courseId,
    );
    if (
      !course ||
      course.status === "archived" ||
      !getCourseLessons(course).some((l) => l.id === lessonId)
    )
      throw new Error("Урок недоступен в этом курсе.");
    if (assignment.completedLessonIds.includes(lessonId)) return;
    commit({
      ...stateRef.current,
      assignments: stateRef.current.assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, completedLessonIds: [...a.completedLessonIds, lessonId] }
          : a,
      ),
    });
  };
  const beginAttempt = (assignmentId: string) => {
    const assignment = assignmentFor(assignmentId);
    requireOwner(assignment.employeeId);
    const attempt = makeAttempt(stateRef.current, assignmentId);
    if (!stateRef.current.attempts.some((a) => a.id === attempt.id))
      withAttempt(attempt);
    return attempt;
  };
  const saveAttemptAnswers = (attemptId: string, answers: Answers) => {
    const attempt = attemptFor(attemptId);
    requireOwner(attempt.employeeId);
    assignmentFor(attempt.assignmentId);
    if (attempt.status !== "in_progress")
      throw new Error("Попытка уже завершена.");
    if (Date.now() > Date.parse(attempt.expiresAt)) {
      withAttempt(gradeAttempt(attempt));
      throw new Error(
        "Время тестирования истекло. Ответы сохранены и отправлены.",
      );
    }
    withAttempt({ ...attempt, answers: normalizeAnswers(attempt, answers) });
  };
  const submitAttempt = (attemptId: string, answers?: Answers) => {
    const attempt = attemptFor(attemptId);
    requireOwner(attempt.employeeId);
    assignmentFor(attempt.assignmentId);
    const graded = gradeAttempt(attempt, answers);
    if (graded !== attempt) withAttempt(graded);
    return graded;
  };
  const reviewAttempt = (attemptId: string, review: ReviewInput) => {
    requireHr();
    const graded = applyReview(
      attemptFor(attemptId),
      review,
      stateRef.current.employees.find((e) => e.id === employeeRef.current)
        ?.name ?? "Кадровая служба",
    );
    withAttempt(graded);
    return graded;
  };
  const visible = (n: Notification) =>
    roleRef.current === "hr"
      ? n.audience === "hr" || n.audience === "all"
      : n.audience !== "hr" &&
        (!n.employeeId || n.employeeId === employeeRef.current);
  const markNotificationRead = (id: string) => {
    const found = stateRef.current.notifications.find((n) => n.id === id);
    if (!found || !visible(found)) return;
    commit({
      ...stateRef.current,
      notifications: stateRef.current.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    });
  };
  const markAllNotificationsRead = () =>
    commit({
      ...stateRef.current,
      notifications: stateRef.current.notifications.map((n) =>
        visible(n) ? { ...n, read: true } : n,
      ),
    });
  const updateSettings = (input: Partial<HrSettings>) => {
    requireHr();
    const settings = { ...stateRef.current.settings, ...input };
    if (!settings.organizationName.trim() || !settings.certificatePrefix.trim())
      throw new Error("Заполните название организации и префикс сертификата.");
    if (
      !Number.isFinite(settings.defaultPassPercent) ||
      settings.defaultPassPercent < 1 ||
      settings.defaultPassPercent > 100
    )
      throw new Error("Проходной балл должен быть от 1 до 100%.");
    if (
      !Number.isFinite(settings.defaultTimeLimitMinutes) ||
      settings.defaultTimeLimitMinutes < 0 ||
      settings.defaultTimeLimitMinutes > 1440
    )
      throw new Error(
        "Время теста должно быть от 0 до 1440 минут; 0 — без ограничения.",
      );
    if (
      !Number.isInteger(settings.defaultMaxAttempts) ||
      settings.defaultMaxAttempts < 0 ||
      settings.defaultMaxAttempts > 100
    )
      throw new Error(
        "Количество попыток должно быть от 0 до 100; 0 — без ограничения.",
      );
    if (
      !Number.isInteger(settings.notificationDaysBefore) ||
      settings.notificationDaysBefore < 0 ||
      settings.notificationDaysBefore > 365
    )
      throw new Error("Срок напоминания должен быть от 0 до 365 дней.");
    commit({ ...stateRef.current, settings });
  };
  const resetDemo = () => {
    requireHr();
    commit(createSeedState());
    setEmployeeId("employee-1");
  };
  const value: HrContextValue = {
    state,
    role,
    employeeId,
    storageError,
    setRole,
    setEmployeeId,
    saveReview,
    saveEmployee,
    saveCourse,
    saveTest,
    saveProgram,
    saveResource,
    archiveCourse,
    archiveProgram,
    deleteTest,
    deleteResource,
    assignCourses,
    enrollCourse,
    changeAssignmentDeadline,
    cancelAssignment,
    completeLesson,
    beginAttempt,
    saveAttemptAnswers,
    submitAttempt,
    reviewAttempt,
    markNotificationRead,
    markAllNotificationsRead,
    updateSettings,
    resetDemo,
  };
  return <HrContext.Provider value={value}>{children}</HrContext.Provider>;
}
export function useHr(): HrContextValue {
  const context = useContext(HrContext);
  if (!context)
    throw new Error("useHr должен использоваться внутри HrProvider.");
  return context;
}
