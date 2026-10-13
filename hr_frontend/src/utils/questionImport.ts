import type { Question, QuestionType } from "../api/types";
import { createId, validateQuestion } from "../store/hrDomain";
import { parseCsv, toCsv } from "./csv";

export const QUESTION_CSV_HEADERS = [
  "type",
  "text",
  "options",
  "correctAnswers",
  "points",
  "explanation",
];
const TYPE_MAP: Record<string, QuestionType> = {
  single: "single",
  multiple: "multiple",
  text: "text",
  open: "open",
  "один ответ": "single",
  "несколько ответов": "multiple",
  "краткий ответ": "text",
  открытый: "open",
};
/** Choice options separated by |. Correct answers are option text or 1-based indices. */
export function parseQuestionImport(
  content: string,
  format: "json" | "csv" = "json",
): Question[] {
  if (content.length > 5_000_000)
    throw new Error("Размер импорта не должен превышать 5 МБ.");
  let input: unknown;
  if (format === "json") {
    try {
      input = JSON.parse(content);
    } catch {
      throw new Error("Не удалось прочитать JSON. Проверьте формат файла.");
    }
    if (
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      "questions" in input
    )
      input = (input as { questions: unknown }).questions;
  } else {
    const rows = parseCsv(content);
    if (rows.length < 2)
      throw new Error("Добавьте строку заголовка и хотя бы один вопрос.");
    const headers = rows.shift()!.map((v) => v.trim());
    if (!["type", "text", "points"].every((h) => headers.includes(h)))
      throw new Error(
        "CSV должен содержать столбцы type, text и points. Скачайте шаблон.",
      );
    input = rows.map((row) =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
    );
  }
  if (!Array.isArray(input) || !input.length || input.length > 500)
    throw new Error("Файл должен содержать от 1 до 500 вопросов.");
  return input.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error(`Строка ${index + 1}: некорректный вопрос.`);
    const item = raw as Record<string, unknown>;
    const id = createId("question");
    const type =
      TYPE_MAP[
        String(item.type ?? "")
          .trim()
          .toLowerCase()
      ];
    if (!type)
      throw new Error(
        `Вопрос ${index + 1}: неизвестный тип. Допустимы single, multiple, text, open.`,
      );
    const optionInput = Array.isArray(item.options)
      ? item.options
      : typeof item.options === "string"
        ? item.options.split("|").filter((v) => v.trim())
        : [];
    const originalIds: string[] = [];
    const options = optionInput.map((o, i) => {
      const object =
        o && typeof o === "object" ? (o as Record<string, unknown>) : null;
      originalIds.push(String(object?.id ?? i + 1));
      return {
        id: `${id}-option-${i + 1}`,
        text: String(object?.text ?? o).trim(),
      };
    });
    const correctInput = Array.isArray(item.correctAnswers)
      ? item.correctAnswers
      : typeof item.correctAnswers === "string"
        ? item.correctAnswers.split("|").filter((v) => v.trim())
        : [];
    const correctAnswers = correctInput.map((answer) => {
      const text = String(answer).trim();
      if (type === "text" || type === "open") return text;
      let optionIndex = originalIds.indexOf(text);
      if (optionIndex < 0)
        optionIndex = options.findIndex((o) => o.text === text);
      if (optionIndex < 0 && /^\d+$/.test(text)) optionIndex = Number(text) - 1;
      if (!options[optionIndex])
        throw new Error(
          `Вопрос ${index + 1}: правильный ответ «${text}» не найден среди вариантов.`,
        );
      return options[optionIndex].id;
    });
    const question: Question = {
      id,
      type,
      text: String(item.text ?? "").trim(),
      options: ["single", "multiple"].includes(type) ? options : [],
      correctAnswers: type === "open" ? [] : [...new Set(correctAnswers)],
      points: Number(item.points ?? 1),
      explanation: String(item.explanation ?? ""),
    };
    try {
      validateQuestion(question);
    } catch (error) {
      throw new Error(
        `Вопрос ${index + 1}: ${error instanceof Error ? error.message : "некорректные данные"}`,
      );
    }
    return question;
  });
}
export const importQuestions = parseQuestionImport;
export function questionCsvTemplate(): string {
  return toCsv(QUESTION_CSV_HEADERS, [
    [
      "single",
      "Выберите правильный вариант",
      "Первый|Второй|Третий",
      "1",
      10,
      "Обоснование правильного ответа",
    ],
    [
      "multiple",
      "Выберите два правильных варианта",
      "Первый|Второй|Третий",
      "1|2",
      10,
      "",
    ],
    ["text", "Введите краткий ответ", "", "SAQ|САК", 5, ""],
    [
      "open",
      "Опишите последовательность действий",
      "",
      "",
      20,
      "Оценивается вручную",
    ],
  ]);
}
