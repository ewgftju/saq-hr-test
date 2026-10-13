import { describe, expect, it } from "vitest";
import type { Attempt, HrState } from "../api/types";
import { isHrState } from "../api/storage";
import { createSeedState } from "../data/seed";
import { csvCell, parseCsv, toCsv } from "../utils/csv";
import {
  parseQuestionImport,
  questionCsvTemplate,
} from "../utils/questionImport";
import {
  applyReview,
  getAssignmentProgress,
  getCertificate,
  getCourseLessons,
  gradeAttempt,
  makeAttempt,
  reconcileCompletions,
  validateTest,
} from "./hrDomain";

function ready(): HrState {
  const state = createSeedState();
  state.assignments.find((a) => a.id === "assignment-1-1")!.completedLessonIds =
    getCourseLessons(state.courses[0]).map((l) => l.id);
  return state;
}
function allCorrect(attempt: Attempt) {
  return Object.fromEntries(
    attempt.questions.map((q) => [q.id, q.correctAnswers]),
  );
}

describe("learning lifecycle", () => {
  it("blocks test until lessons are complete and creates a frozen test snapshot", () => {
    const state = createSeedState();
    expect(() => makeAttempt(state, "assignment-1-1")).toThrow("изучите");
    state.assignments.find(
      (a) => a.id === "assignment-1-1",
    )!.completedLessonIds = getCourseLessons(state.courses[0]).map((l) => l.id);
    const attempt = makeAttempt(state, "assignment-1-1");
    const title = attempt.questions[0].text;
    state.tests[0].questions[0].text = "Changed";
    expect(attempt.questions[0].text).toBe(title);
    expect(attempt.testSnapshot.questions[0].text).toBe(title);
  });
  it("failed attempts do not complete course or issue a certificate; pass does", () => {
    const state = ready();
    const attempt = makeAttempt(state, "assignment-1-1");
    state.attempts.push(gradeAttempt(attempt, {}));
    const assignment = state.assignments.find(
      (a) => a.id === attempt.assignmentId,
    )!;
    expect(getAssignmentProgress(state, assignment).isComplete).toBe(false);
    expect(getCertificate(state, assignment)).toBeNull();
    const retry = makeAttempt(state, assignment.id);
    state.attempts.push(gradeAttempt(retry, allCorrect(retry)));
    const finished = reconcileCompletions(state);
    expect(
      getAssignmentProgress(
        finished,
        finished.assignments.find((a) => a.id === assignment.id)!,
      ).progress,
    ).toBe(100);
    expect(
      getCertificate(
        finished,
        finished.assignments.find((a) => a.id === assignment.id)!,
      ),
    ).not.toBeNull();
  });
  it("resumes active attempt without spending another attempt and enforces maxAttempts", () => {
    const state = ready();
    const a = makeAttempt(state, "assignment-1-1");
    state.attempts.push(a);
    expect(makeAttempt(state, a.assignmentId).id).toBe(a.id);
    state.tests[0].maxAttempts = 1;
    state.attempts[state.attempts.length - 1] = gradeAttempt(a, {});
    expect(() => makeAttempt(state, a.assignmentId)).toThrow("исчерпаны");
    state.tests[0].maxAttempts = 0;
    expect(makeAttempt(state, a.assignmentId).number).toBe(2);
  });
  it("uses deadline relative to supplied actual date and counts final day as available", () => {
    const state = ready();
    const a = state.assignments.find((a) => a.id === "assignment-1-1")!;
    a.deadline = "2026-10-13";
    expect(
      getAssignmentProgress(state, a, new Date("2026-10-13T10:00:00"))
        .isOverdue,
    ).toBe(false);
    expect(
      getAssignmentProgress(state, a, new Date("2026-10-14T00:00:00"))
        .isOverdue,
    ).toBe(true);
  });
});
describe("assessment grading", () => {
  it("rejects late new answers, grades persisted answers and submitting twice is idempotent", () => {
    const state = ready();
    const start = new Date("2026-10-13T10:00:00Z");
    const a = makeAttempt(state, "assignment-1-1", start);
    a.answers = { [a.questions[0].id]: a.questions[0].correctAnswers };
    const result = gradeAttempt(
      a,
      allCorrect(a),
      new Date(Date.parse(a.expiresAt) + 1),
    );
    expect(result.percent).toBeCloseTo(33.33);
    expect(result.status).toBe("failed");
    expect(gradeAttempt(result, allCorrect(a))).toBe(result);
  });
  it("allows unlimited time and attempts while retaining threshold accuracy", () => {
    const state = ready();
    state.tests[0].timeLimitMinutes = 0;
    state.tests[0].maxAttempts = 0;
    state.tests[0].passPercent = 67;
    expect(() => validateTest(state.tests[0])).not.toThrow();
    const a = makeAttempt(state, "assignment-1-1");
    expect(a.expiresAt).toBe("");
    const answers = allCorrect(a);
    delete answers[a.questions[2].id];
    const result = gradeAttempt(a, answers, new Date("2030-01-01"));
    expect(result.percent).toBeCloseTo(66.67);
    expect(result.status).toBe("failed");
  });
  it("requires exact multiple choice sets and accepts trimmed case-insensitive short text", () => {
    const state = ready();
    const a = makeAttempt(state, "assignment-1-1");
    const answers = allCorrect(a);
    const q = a.questions.find((q) => q.type === "multiple")!;
    answers[q.id] = [q.correctAnswers[0]];
    expect(gradeAttempt(a, answers).questionScores[q.id]).toBe(0);
    const assignment = state.assignments.find(
      (a) => a.id === "assignment-1-2",
    )!;
    assignment.completedLessonIds = getCourseLessons(state.courses[1]).map(
      (l) => l.id,
    );
    const security = makeAttempt(state, assignment.id);
    const secAnswers = allCorrect(security);
    secAnswers.s3 = ["  2fa  "];
    expect(gradeAttempt(security, secAnswers).status).toBe("passed");
  });
  it("holds nonblank open answers for review and excludes blank answers from review queue", () => {
    const state = ready();
    const a = makeAttempt(state, "assignment-1-3");
    const answers = {
      k1: a.questions[0].correctAnswers,
      k2: ["Сначала зафиксировать замечание."],
    };
    const pending = gradeAttempt(a, answers);
    expect(pending.status).toBe("pending_review");
    expect(() =>
      applyReview(pending, { scores: { k2: 25 } }, "Reviewer"),
    ).toThrow();
    expect(
      applyReview(
        pending,
        { scores: { k2: 20 }, comments: { k2: "Верно" } },
        "Reviewer",
      ).status,
    ).toBe("passed");
    expect(
      gradeAttempt(a, { k1: a.questions[0].correctAnswers, k2: ["   "] })
        .status,
    ).toBe("failed");
  });
  it("supports negative marking without negative total score", () => {
    const state = ready();
    state.tests[0].allowNegativeMarking = true;
    state.tests[0].negativePoints = 5;
    const a = makeAttempt(state, "assignment-1-1");
    const answers = Object.fromEntries(
      a.questions.map((q) => [
        q.id,
        [q.options.find((o) => !q.correctAnswers.includes(o.id))!.id],
      ]),
    );
    const result = gradeAttempt(a, answers);
    expect(result.score).toBe(0);
    expect(Object.values(result.questionScores)).toEqual([-5, -5, -5]);
  });
});
describe("persistence and imports", () => {
  it("validates seed and rejects corrupt or unsupported data before hydration", () => {
    const state = createSeedState();
    expect(isHrState(state)).toBe(true);
    expect(isHrState({ ...state, version: 2 })).toBe(false);
    expect(isHrState({ ...state, attempts: [{ id: "broken" }] })).toBe(false);
    state.courses[0].chapters[0].lessons = null as never;
    expect(isHrState(state)).toBe(false);
  });
  it("imports every question in the CSV template and fails atomically on invalid questions", () => {
    const questions = parseQuestionImport(questionCsvTemplate(), "csv");
    expect(questions).toHaveLength(4);
    expect(questions.map((q) => q.type)).toEqual([
      "single",
      "multiple",
      "text",
      "open",
    ]);
    expect(() =>
      parseQuestionImport(
        JSON.stringify([
          {
            type: "single",
            text: "Broken",
            options: ["one"],
            correctAnswers: ["1"],
            points: 10,
          },
        ]),
      ),
    ).toThrow("минимум два");
    expect(() => parseQuestionImport("{")).toThrow("JSON");
  });
  it("escapes formula injection and round-trips quoted multi-line CSV", () => {
    expect(csvCell(" =SUM(A1:A2)")).toBe('"\' =SUM(A1:A2)"');
    const csv = toCsv(["name", "description"], [["Иван", 'A;B\n"C"']]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(parseCsv(csv)).toEqual([
      ["name", "description"],
      ["Иван", 'A;B\n"C"'],
    ]);
  });
});
