import type { Question, QuestionType } from "../../../api/types";

export const questionTypeLabels: Record<QuestionType, string> = {
  single: "Один правильный ответ",
  multiple: "Несколько правильных ответов",
  text: "Короткий ответ",
  open: "Развёрнутый ответ",
};
export const newTestId = (prefix = "q") =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const newQuestion = (type: QuestionType = "single"): Question => ({
  id: newTestId(),
  type,
  text: "",
  options:
    type === "single" || type === "multiple"
      ? [
          { id: newTestId("o"), text: "" },
          { id: newTestId("o"), text: "" },
        ]
      : [],
  correctAnswers: [],
  points: 1,
  explanation: "",
});
export const testStatusLabels = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "В архиве",
} as const;
export const attemptStatusLabels = {
  in_progress: "Проходит тест",
  passed: "Сдан",
  failed: "Не сдан",
  pending_review: "На проверке",
} as const;
export const attemptTones = {
  in_progress: "blue",
  passed: "green",
  failed: "red",
  pending_review: "amber",
} as const;
export const dateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export const isAnswered = (answer?: string[]) =>
  Boolean(answer?.some((value) => value.trim().length));
export function downloadText(
  name: string,
  value: string,
  mime = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([value], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[=+@\-\t\r]/.test(text) && typeof value !== "number")
      text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  downloadText(
    name,
    "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}

export function validateQuestion(
  question: Question,
  index: number,
): string | null {
  const prefix = `Вопрос ${index + 1}: `;
  if (!question.text.trim()) return prefix + "введите текст вопроса.";
  if (!Number.isFinite(question.points) || question.points <= 0)
    return prefix + "баллы должны быть больше нуля.";
  if (question.type === "single" || question.type === "multiple") {
    if (
      question.options.length < 2 ||
      question.options.some((option) => !option.text.trim())
    )
      return prefix + "добавьте минимум два заполненных варианта ответа.";
    if (
      new Set(
        question.options.map((option) => option.text.trim().toLowerCase()),
      ).size !== question.options.length
    )
      return prefix + "варианты ответа не должны повторяться.";
    if (
      !question.correctAnswers.length ||
      question.correctAnswers.some(
        (id) => !question.options.some((option) => option.id === id),
      )
    )
      return prefix + "отметьте правильные варианты ответа.";
    if (question.type === "single" && question.correctAnswers.length !== 1)
      return prefix + "выберите только один правильный ответ.";
  }
  if (
    question.type === "text" &&
    (!question.correctAnswers.length ||
      question.correctAnswers.some((answer) => !answer.trim()))
  )
    return prefix + "укажите хотя бы один допустимый короткий ответ.";
  return null;
}

function parseCsv(source: string): string[][] {
  const firstLine = source.split(/\r?\n/)[0];
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted)
    throw new Error("CSV: незакрытые кавычки. Используйте шаблон импорта.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeQuestion(raw: unknown, index: number): Question {
  if (!raw || typeof raw !== "object")
    throw new Error(`Строка ${index + 1}: ожидается объект вопроса.`);
  const source = raw as Record<string, unknown>;
  const type = source.type as QuestionType;
  if (!Object.hasOwn(questionTypeLabels, type))
    throw new Error(
      `Строка ${index + 1}: тип должен быть single, multiple, text или open.`,
    );
  const rawOptions = Array.isArray(source.options)
    ? source.options
    : typeof source.options === "string"
      ? source.options.split("|").filter(Boolean)
      : [];
  const oldIds = rawOptions.map((option, i) =>
    typeof option === "object" && option && "id" in option
      ? String(option.id)
      : String(i + 1),
  );
  const options = rawOptions.map((option) => ({
    id: newTestId("o"),
    text:
      typeof option === "string"
        ? option.trim()
        : String((option as { text?: unknown })?.text ?? "").trim(),
  }));
  const rawAnswers =
    source.correctAnswers ?? source.correctanswers ?? source.correct ?? [];
  const answers = Array.isArray(rawAnswers)
    ? rawAnswers.map(String)
    : String(rawAnswers).split("|").filter(Boolean);
  const correctAnswers =
    type === "single" || type === "multiple"
      ? answers.map((answer) => {
          let i = oldIds.indexOf(answer.trim());
          if (i < 0)
            i = options.findIndex((option) => option.text === answer.trim());
          if (i < 0 && /^\d+$/.test(answer.trim()))
            i = Number(answer.trim()) - 1;
          if (i < 0 || i >= options.length)
            throw new Error(
              `Вопрос ${index + 1}: правильный ответ «${answer}» не найден среди вариантов.`,
            );
          return options[i].id;
        })
      : type === "text"
        ? answers.map((answer) => answer.trim())
        : [];
  const question: Question = {
    id: newTestId(),
    type,
    text: String(source.text ?? source.question ?? "").trim(),
    options: type === "single" || type === "multiple" ? options : [],
    correctAnswers: [...new Set(correctAnswers)],
    points: Number(source.points ?? 1),
    explanation: String(source.explanation ?? "").trim(),
  };
  const error = validateQuestion(question, index);
  if (error) throw new Error(error);
  return question;
}

export async function importQuestions(file: File): Promise<Question[]> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Размер файла не должен превышать 5 МБ.");
  const text = (await file.text()).replace(/^\uFEFF/, "");
  let rows: unknown[];
  if (/\.json$/i.test(file.name)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("JSON содержит ошибку синтаксиса. Сверьтесь с шаблоном.");
    }
    rows = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          "questions" in parsed &&
          Array.isArray(parsed.questions)
        ? parsed.questions
        : [];
  } else if (/\.csv$/i.test(file.name)) {
    const data = parseCsv(text);
    const headers = (data.shift() ?? []).map((value) =>
      value.trim().toLowerCase(),
    );
    if (
      !headers.includes("type") ||
      !headers.some((header) => header === "question" || header === "text")
    )
      throw new Error(
        "CSV должен содержать заголовки type и question. Скачайте шаблон.",
      );
    rows = data.map((values) =>
      Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])),
    );
  } else throw new Error("Поддерживаются только файлы JSON и CSV.");
  if (!rows.length) throw new Error("В файле нет вопросов.");
  if (rows.length > 500)
    throw new Error("За один раз можно импортировать не больше 500 вопросов.");
  return rows.map(normalizeQuestion);
}

export function downloadQuestionTemplate(format: "json" | "csv") {
  if (format === "csv")
    downloadCsv("shablon-voprosov.csv", [
      ["type", "question", "options", "correct", "points", "explanation"],
      [
        "single",
        "Что содержит индивидуальный план обучения?",
        "Список назначенных курсов|Пароли сотрудников|Банковские реквизиты",
        "1",
        1,
        "В плане перечислены назначенные сотруднику курсы.",
      ],
      [
        "multiple",
        "Какие действия помогают защитить аккаунт?",
        "Уникальный пароль|Передача пароля коллегам|Двухфакторная проверка",
        "1|3",
        2,
        "Используйте уникальный пароль и дополнительную проверку входа.",
      ],
      [
        "text",
        "Введите сокращённое название системы",
        "",
        "SAQ|САК",
        1,
        "Допускаются ответы SAQ и САК.",
      ],
      [
        "open",
        "Опишите ваш план профессионального развития.",
        "",
        "",
        3,
        "Ответ проверяет кадровая служба.",
      ],
    ]);
  else
    downloadText(
      "shablon-voprosov.json",
      JSON.stringify(
        {
          questions: [
            {
              type: "single",
              text: "Что содержит индивидуальный план обучения?",
              options: ["Список назначенных курсов", "Пароли сотрудников"],
              correctAnswers: ["1"],
              points: 1,
              explanation: "В плане указаны назначенные сотруднику курсы.",
            },
            {
              type: "open",
              text: "Опишите ваш план профессионального развития.",
              options: [],
              correctAnswers: [],
              points: 3,
            },
          ],
        },
        null,
        2,
      ),
      "application/json",
    );
}
