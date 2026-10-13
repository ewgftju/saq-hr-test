import type {
  Answers,
  Assignment,
  AssignmentProgress,
  Attempt,
  Certificate,
  Course,
  HrState,
  Question,
  ReviewInput,
  Test,
} from "../api/types";

export function createId(prefix = "item"): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}
export function getCourseLessons(course: Course) {
  return course.chapters.flatMap((chapter) => chapter.lessons);
}
export function isSafeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol);
  } catch {
    return false;
  }
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function getAssignmentProgress(
  state: HrState,
  assignment: Assignment,
  now = new Date(),
): AssignmentProgress {
  const course = state.courses.find((item) => item.id === assignment.courseId);
  const lessons = course ? getCourseLessons(course) : [];
  const done = lessons.filter((lesson) =>
    assignment.completedLessonIds.includes(lesson.id),
  ).length;
  const attempts = state.attempts.filter(
    (item) => item.assignmentId === assignment.id,
  );
  const latest = [...attempts]
    .sort(
      (a, b) =>
        Date.parse(a.startedAt) - Date.parse(b.startedAt) ||
        a.number - b.number,
    )
    .at(-1);
  const finished = attempts.filter((item) =>
    ["passed", "failed"].includes(item.status),
  );
  const bestScore = finished.length
    ? Math.max(...finished.map((item) => item.percent))
    : null;
  const passed =
    !course?.testId ||
    attempts.some(
      (item) => item.testId === course.testId && item.status === "passed",
    );
  const isComplete =
    !!assignment.completedAt ||
    (!!course &&
      done === lessons.length &&
      passed &&
      (lessons.length > 0 || !!course.testId));
  const isOverdue =
    !isComplete &&
    !assignment.cancelledAt &&
    !!assignment.deadline &&
    now.getTime() > new Date(`${assignment.deadline}T23:59:59.999`).getTime();
  const totalSteps = lessons.length + (course?.testId ? 1 : 0);
  const progress = isComplete
    ? 100
    : totalSteps
      ? Math.min(
          99,
          Math.round(
            ((done + (course?.testId && passed ? 1 : 0)) / totalSteps) * 100,
          ),
        )
      : 0;
  let status: AssignmentProgress["status"] = isComplete
    ? "completed"
    : latest?.status === "pending_review"
      ? "pending_review"
      : latest?.status === "failed"
        ? "failed"
        : done > 0 || !!latest
          ? "in_progress"
          : "not_started";
  if (isOverdue) status = "overdue";
  return {
    status,
    progress,
    completedLessons: done,
    totalLessons: lessons.length,
    bestScore,
    lastAttempt: latest,
    isComplete,
    isOverdue,
  };
}
export const assignmentStatusLabels: Record<
  AssignmentProgress["status"],
  string
> = {
  not_started: "Не начато",
  in_progress: "В процессе",
  pending_review: "На проверке",
  completed: "Завершено",
  failed: "Не пройдено",
  overdue: "Просрочено",
};
export function getCertificate(
  state: HrState,
  assignment: Assignment,
): Certificate | null {
  if (
    assignment.cancelledAt ||
    !assignment.completedAt ||
    !getAssignmentProgress(state, assignment).isComplete
  )
    return null;
  const employee = state.employees.find(
    (item) => item.id === assignment.employeeId,
  );
  const course = state.courses.find((item) => item.id === assignment.courseId);
  if (!employee || !course || course.certificateEnabled === false) return null;
  return {
    id: `${state.settings.certificatePrefix}-${assignment.id
      .replace(/^assignment-/, "")
      .slice(-8)
      .toUpperCase()}`,
    employeeName: employee.name,
    courseTitle: course.title,
    completedAt: assignment.completedAt,
    score: getAssignmentProgress(state, assignment).bestScore,
    durationHours: course.durationHours,
  };
}
export function validateQuestion(question: Question): void {
  if (!question.id || !question.text.trim())
    throw new Error("Укажите текст вопроса.");
  if (!Number.isFinite(question.points) || question.points <= 0)
    throw new Error("Баллы за вопрос должны быть больше нуля.");
  if (!["single", "multiple", "text", "open"].includes(question.type))
    throw new Error("Неизвестный тип вопроса.");
  if (
    !Array.isArray(question.options) ||
    !Array.isArray(question.correctAnswers)
  )
    throw new Error("Некорректная структура ответов.");
  if (["single", "multiple"].includes(question.type)) {
    if (
      question.options.length < 2 ||
      question.options.some((option) => !option.id || !option.text.trim())
    )
      throw new Error("Добавьте минимум два заполненных варианта ответа.");
    if (
      new Set(question.options.map((option) => option.id)).size !==
      question.options.length
    )
      throw new Error(
        "Варианты ответа должны иметь уникальные идентификаторы.",
      );
    if (
      !question.correctAnswers.length ||
      question.correctAnswers.some(
        (id) => !question.options.some((option) => option.id === id),
      )
    )
      throw new Error("Отметьте правильные варианты ответа.");
    if (question.type === "single" && question.correctAnswers.length !== 1)
      throw new Error("Для одного ответа отметьте один правильный вариант.");
  }
  if (
    question.type === "text" &&
    !question.correctAnswers.some((answer) => answer.trim())
  )
    throw new Error("Укажите допустимый краткий ответ.");
}
export function validateTest(test: Test): void {
  if (!test.title.trim()) throw new Error("Укажите название теста.");
  if (
    !Number.isFinite(test.passPercent) ||
    test.passPercent < 1 ||
    test.passPercent > 100
  )
    throw new Error("Проходной балл должен быть от 1 до 100%.");
  if (
    !Number.isInteger(test.maxAttempts) ||
    test.maxAttempts < 0 ||
    test.maxAttempts > 100
  )
    throw new Error(
      "Количество попыток должно быть от 0 до 100; 0 — без ограничения.",
    );
  if (
    !Number.isFinite(test.timeLimitMinutes) ||
    test.timeLimitMinutes < 0 ||
    test.timeLimitMinutes > 1440
  )
    throw new Error(
      "Время теста должно быть от 0 до 1440 минут; 0 — без ограничения.",
    );
  if (!Number.isFinite(test.negativePoints) || test.negativePoints < 0)
    throw new Error("Штрафные баллы не могут быть отрицательными.");
  if (!Number.isInteger(test.questionLimit) || test.questionLimit < 0)
    throw new Error(
      "Количество вопросов должно быть целым неотрицательным числом.",
    );
  if (test.status === "published" && !test.questions.length)
    throw new Error("Для публикации добавьте хотя бы один вопрос.");
  if (new Set(test.questions.map((q) => q.id)).size !== test.questions.length)
    throw new Error("Идентификаторы вопросов должны быть уникальны.");
  test.questions.forEach(validateQuestion);
}
export function validateCourse(course: Course, state: HrState): void {
  if (!course.title.trim()) throw new Error("Укажите название курса.");
  if (!Number.isFinite(course.durationHours) || course.durationHours < 0)
    throw new Error("Продолжительность не может быть отрицательной.");
  const lessons = getCourseLessons(course);
  if (new Set(lessons.map((l) => l.id)).size !== lessons.length)
    throw new Error("Идентификаторы уроков должны быть уникальны.");
  if (course.testId && !state.tests.some((test) => test.id === course.testId))
    throw new Error("Выбранный тест не найден.");
  if (course.status === "published") {
    if (!lessons.length && !course.testId)
      throw new Error("Для публикации добавьте уроки или итоговый тест.");
    if (
      course.testId &&
      state.tests.find((test) => test.id === course.testId)?.status !==
        "published"
    )
      throw new Error("Опубликуйте итоговый тест перед публикацией курса.");
    for (const lesson of lessons) {
      if (!lesson.title.trim())
        throw new Error("Укажите название каждого урока.");
      if (lesson.type === "text" && !lesson.content.trim())
        throw new Error("Добавьте содержание текстового урока.");
      if (
        ["link", "video", "audio"].includes(lesson.type) &&
        !lesson.fileId &&
        !isSafeUrl(lesson.url ?? "")
      )
        throw new Error(
          "Укажите корректную http/https ссылку на материал или загрузите файл.",
        );
      if (
        lesson.type === "file" &&
        !lesson.fileId &&
        !isSafeUrl(lesson.url ?? "")
      )
        throw new Error("Загрузите файл урока.");
    }
  }
}
function shuffle<T>(values: T[]): T[] {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export function makeAttempt(
  state: HrState,
  assignmentId: string,
  now = new Date(),
): Attempt {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment || assignment.cancelledAt)
    throw new Error("Действующее назначение не найдено.");
  const course = state.courses.find((item) => item.id === assignment.courseId);
  const test = state.tests.find((item) => item.id === course?.testId);
  if (
    !course ||
    !test ||
    course.status === "archived" ||
    test.status !== "published"
  )
    throw new Error("Тест недоступен для прохождения.");
  const previous = state.attempts.filter(
    (item) => item.assignmentId === assignmentId && item.testId === test.id,
  );
  const active = previous.find((item) => item.status === "in_progress");
  if (active) return active;
  if (getAssignmentProgress(state, assignment, now).isComplete)
    throw new Error("Курс уже завершён.");
  if (
    getCourseLessons(course).some(
      (lesson) => !assignment.completedLessonIds.includes(lesson.id),
    )
  )
    throw new Error("Сначала изучите все уроки курса.");
  if (previous.some((item) => item.status === "pending_review"))
    throw new Error("Предыдущая попытка ожидает проверки.");
  if (test.maxAttempts > 0 && previous.length >= test.maxAttempts)
    throw new Error(
      "Доступные попытки исчерпаны. Обратитесь в кадровую службу.",
    );
  const snapshot: Test = structuredClone(test);
  let questions = structuredClone(test.questions);
  if (
    test.shuffleQuestions ||
    (test.questionLimit > 0 && test.questionLimit < questions.length)
  )
    questions = shuffle(questions);
  if (test.questionLimit > 0)
    questions = questions.slice(0, test.questionLimit);
  if (!questions.length) throw new Error("В тесте нет вопросов.");
  if (test.shuffleAnswers)
    questions = questions.map((question) => ({
      ...question,
      options: shuffle(question.options),
    }));
  return {
    id: createId("attempt"),
    employeeId: assignment.employeeId,
    assignmentId,
    courseId: course.id,
    testId: test.id,
    number: previous.length + 1,
    startedAt: now.toISOString(),
    expiresAt:
      test.timeLimitMinutes > 0
        ? new Date(now.getTime() + test.timeLimitMinutes * 60_000).toISOString()
        : "",
    testSnapshot: snapshot,
    questions,
    answers: {},
    status: "in_progress",
    score: 0,
    maxScore: questions.reduce((sum, q) => sum + q.points, 0),
    percent: 0,
    questionScores: {},
    reviewComments: {},
  };
}
export function normalizeAnswers(attempt: Attempt, answers: Answers): Answers {
  const clean: Answers = {};
  for (const question of attempt.questions) {
    const input = answers[question.id];
    if (
      !Array.isArray(input) ||
      input.some((value) => typeof value !== "string")
    )
      continue;
    if (["single", "multiple"].includes(question.type))
      clean[question.id] = [
        ...new Set(
          input.filter((id) =>
            question.options.some((option) => option.id === id),
          ),
        ),
      ].slice(0, question.type === "single" ? 1 : question.options.length);
    else
      clean[question.id] = input
        .slice(0, 1)
        .map((value) => value.slice(0, 20_000));
  }
  return clean;
}
export function gradeAttempt(
  attempt: Attempt,
  answers?: Answers,
  now = new Date(),
): Attempt {
  if (attempt.status !== "in_progress") return attempt;
  const clean = normalizeAnswers(
    attempt,
    answers &&
      (!attempt.expiresAt || now.getTime() <= Date.parse(attempt.expiresAt))
      ? answers
      : attempt.answers,
  );
  const scores: Record<string, number> = {};
  let pending = false;
  for (const question of attempt.questions) {
    const values = clean[question.id] ?? [];
    if (question.type === "open") {
      if (values.some((value) => value.trim())) pending = true;
      else scores[question.id] = 0;
      continue;
    }
    const filled = values.some((value) => value.trim());
    const normalize = (value: string) =>
      value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
    const correct =
      question.type === "text"
        ? question.correctAnswers.some(
            (value) => normalize(value) === normalize(values[0] ?? ""),
          )
        : values.length === question.correctAnswers.length &&
          values.every((value) => question.correctAnswers.includes(value));
    scores[question.id] =
      correct && filled
        ? question.points
        : filled && attempt.testSnapshot.allowNegativeMarking
          ? -attempt.testSnapshot.negativePoints
          : 0;
  }
  const score = Math.max(
    0,
    Object.values(scores).reduce((sum, value) => sum + value, 0),
  );
  const percent = Math.round((score / attempt.maxScore) * 10_000) / 100;
  return {
    ...attempt,
    answers: clean,
    questionScores: scores,
    score,
    percent,
    submittedAt: now.toISOString(),
    status: pending
      ? "pending_review"
      : score * 100 >= attempt.maxScore * attempt.testSnapshot.passPercent
        ? "passed"
        : "failed",
  };
}
export function applyReview(
  attempt: Attempt,
  review: ReviewInput,
  reviewer: string,
  now = new Date(),
): Attempt {
  if (attempt.status !== "pending_review")
    throw new Error("Эта попытка не ожидает ручной проверки.");
  const questionScores = { ...attempt.questionScores };
  const reviewComments = { ...attempt.reviewComments };
  for (const question of attempt.questions.filter(
    (item) => item.type === "open",
  )) {
    const score = review.scores[question.id];
    if (!Number.isFinite(score) || score < 0 || score > question.points)
      throw new Error(
        `Оцените все открытые вопросы: от 0 до ${question.points} баллов.`,
      );
    questionScores[question.id] = score;
    reviewComments[question.id] = (review.comments?.[question.id] ?? "").trim();
  }
  const score = Math.max(
    0,
    Object.values(questionScores).reduce((sum, value) => sum + value, 0),
  );
  const percent = Math.round((score / attempt.maxScore) * 10_000) / 100;
  return {
    ...attempt,
    questionScores,
    reviewComments,
    score,
    percent,
    status:
      score * 100 >= attempt.maxScore * attempt.testSnapshot.passPercent
        ? "passed"
        : "failed",
    reviewedAt: now.toISOString(),
    reviewedBy: reviewer,
  };
}
export function reconcileCompletions(
  state: HrState,
  now = new Date(),
): HrState {
  return {
    ...state,
    assignments: state.assignments.map((assignment) =>
      !assignment.cancelledAt &&
      !assignment.completedAt &&
      getAssignmentProgress(state, assignment, now).isComplete
        ? { ...assignment, completedAt: now.toISOString() }
        : assignment,
    ),
  };
}
