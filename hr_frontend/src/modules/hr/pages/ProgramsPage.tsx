import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  Progress,
} from "../../../components/ui";
import { useHr } from "../../../store/HrContext";
import { getAssignmentProgress } from "../../../utils/domain";
import type { Program } from "../../../api/types";
import {
  dateLabel,
  entityLabels,
  errorText,
  newId,
  today,
} from "./CourseShared";

const blankProgram = (): Program => ({
  id: newId("program"),
  title: "",
  description: "",
  courseIds: [],
  employeeIds: [],
  deadline: "",
  status: "draft",
});

export default function ProgramsPage() {
  const {
    state,
    role,
    employeeId,
    saveProgram,
    archiveProgram,
    assignCourses,
  } = useHr();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState<Program | null>(null);
  const [assignmentProgram, setAssignmentProgram] = useState<Program | null>(
    null,
  );
  const [detail, setDetail] = useState<Program | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const programs = state.programs.filter(
    (program) =>
      (role === "hr" ||
        (program.status !== "archived" &&
          program.employeeIds.includes(employeeId))) &&
      (status === "all" || status === program.status) &&
      `${program.title} ${program.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const activeEmployees = state.employees.filter(
    (employee) =>
      employee.status === "active" &&
      `${employee.name} ${employee.department}`
        .toLowerCase()
        .includes(employeeSearch.toLowerCase()),
  );
  const calculateProgress = (program: Program, memberId: string) => {
    if (!program.courseIds.length) return 0;
    return Math.round(
      program.courseIds.reduce((sum, courseId) => {
        const assignment = state.assignments.find(
          (assignment) =>
            assignment.courseId === courseId &&
            assignment.employeeId === memberId &&
            !assignment.cancelledAt,
        );
        return (
          sum +
          (assignment ? getAssignmentProgress(state, assignment).progress : 0)
        );
      }, 0) / program.courseIds.length,
    );
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setError("");
    try {
      saveProgram(draft);
      setDraft(null);
      setNotice("Программа сохранена.");
    } catch (error) {
      setError(errorText(error));
    }
  };
  const assign = (event: FormEvent) => {
    event.preventDefault();
    if (!assignmentProgram) return;
    setError("");
    try {
      const count = assignCourses({
        employeeIds: selected,
        courseIds: assignmentProgram.courseIds,
        deadline,
        required: true,
      });
      saveProgram({
        ...assignmentProgram,
        deadline,
        employeeIds: [
          ...new Set([...assignmentProgram.employeeIds, ...selected]),
        ],
      });
      setAssignmentProgram(null);
      setNotice(
        `Назначено курсов сотрудникам: ${count}. Уже активные назначения пропущены.`,
      );
    } catch (error) {
      setError(errorText(error));
    }
  };
  return (
    <>
      <PageHeading
        title="Программы обучения"
        subtitle="Учебные программы для повышения квалификации и подготовки кандидатов"
        action={
          role === "hr" ? (
            <Button
              onClick={() => {
                setError("");
                setDraft(blankProgram());
              }}
            >
              <Plus size={18} /> Создать программу
            </Button>
          ) : undefined
        }
      />
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      {error && !draft && !assignmentProgram && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="panel toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Поиск программы"
            placeholder="Найти программу обучения"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {role === "hr" && (
          <select
            aria-label="Статус программы"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Все статусы</option>
            <option value="published">Опубликованные</option>
            <option value="draft">Черновики</option>
            <option value="archived">В архиве</option>
          </select>
        )}
      </div>
      {!programs.length ? (
        <EmptyState
          title="Программы не найдены"
          description={
            role === "hr"
              ? "Создайте программу, объедините в ней курсы и назначьте сотрудникам."
              : "Назначенные вам программы появятся здесь."
          }
        />
      ) : (
        <div className="cards course-grid">
          {programs.map((program) => (
            <article key={program.id} className="panel" style={{ padding: 24 }}>
              <div className="section-heading">
                <div className="stat-icon">
                  <GraduationCap size={25} />
                </div>
                <Badge tone={program.status === "published" ? "green" : "gray"}>
                  {entityLabels[program.status]}
                </Badge>
              </div>
              <h2>{program.title}</h2>
              <p className="muted" style={{ minHeight: 55 }}>
                {program.description}
              </p>
              <div className="course-meta">
                <span>
                  <BookOpen size={16} /> {program.courseIds.length} курсов
                </span>
                <span>
                  <Users size={16} /> {program.employeeIds.length} сотрудников
                </span>
              </div>
              <p className="muted">
                <CalendarDays size={15} style={{ verticalAlign: "middle" }} />{" "}
                Срок: {dateLabel(program.deadline)}
              </p>
              {role === "employee" && (
                <Progress value={calculateProgress(program, employeeId)} />
              )}
              <div className="actions" style={{ marginTop: 20 }}>
                <Button variant="outline" onClick={() => setDetail(program)}>
                  Подробнее <ArrowRight size={16} />
                </Button>
                {role === "hr" && (
                  <>
                    <Button
                      variant="ghost"
                      title="Изменить программу"
                      aria-label={`Изменить ${program.title}`}
                      onClick={() => {
                        setError("");
                        setDraft(structuredClone(program));
                      }}
                    >
                      <Pencil size={17} />
                    </Button>
                    <Button
                      disabled={program.status !== "published"}
                      onClick={() => {
                        setError("");
                        setSelected(
                          program.employeeIds.filter((id) =>
                            state.employees.some(
                              (employee) =>
                                employee.id === id &&
                                employee.status === "active",
                            ),
                          ),
                        );
                        setDeadline(program.deadline);
                        setEmployeeSearch("");
                        setAssignmentProgram(program);
                      }}
                    >
                      Назначить
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={!!draft}
        title={
          draft && state.programs.some((program) => program.id === draft.id)
            ? "Редактирование программы"
            : "Новая программа"
        }
        wide
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Отмена
            </Button>
            <Button form="program-editor" type="submit">
              Сохранить программу
            </Button>
          </>
        }
      >
        {draft && (
          <form id="program-editor" onSubmit={save}>
            {error && <div className="alert error">{error}</div>}
            <Field label="Название программы *">
              <input
                required
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                placeholder="Повышение квалификации государственных аудиторов"
              />
            </Field>
            <Field label="Описание">
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="Статус">
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      status: event.target.value as Program["status"],
                    })
                  }
                >
                  <option value="draft">Черновик</option>
                  <option value="published">Опубликована</option>
                  <option value="archived">В архиве</option>
                </select>
              </Field>
              <Field label="Плановый срок завершения">
                <input
                  type="date"
                  value={draft.deadline}
                  onChange={(event) =>
                    setDraft({ ...draft, deadline: event.target.value })
                  }
                />
              </Field>
            </div>
            <div className="field">
              <span className="field-label">Курсы программы *</span>
              <small className="field-hint">
                Выбранные курсы отображаются в порядке добавления в программу.
              </small>
              <div style={{ maxHeight: 330, overflowY: "auto" }}>
                {state.courses
                  .filter(
                    (course) =>
                      course.status !== "archived" ||
                      draft.courseIds.includes(course.id),
                  )
                  .map((course) => (
                    <label
                      key={course.id}
                      className="check-row"
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: 12,
                        borderBottom: "1px solid #edf0f4",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draft.courseIds.includes(course.id)}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            courseIds: event.target.checked
                              ? [...draft.courseIds, course.id]
                              : draft.courseIds.filter(
                                  (id) => id !== course.id,
                                ),
                          })
                        }
                      />
                      <span style={{ flex: 1 }}>
                        <strong>{course.title}</strong>
                        <span
                          className="muted small"
                          style={{ display: "block" }}
                        >
                          {course.durationHours} ч. ·{" "}
                          {entityLabels[course.status]}
                        </span>
                      </span>
                      {draft.courseIds.includes(course.id) && (
                        <Badge tone="blue">
                          {draft.courseIds.indexOf(course.id) + 1}
                        </Badge>
                      )}
                    </label>
                  ))}
              </div>
            </div>
            {state.programs.some((program) => program.id === draft.id) &&
              draft.status !== "archived" && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("Переместить программу в архив?")) {
                      try {
                        archiveProgram(draft.id);
                        setDraft(null);
                        setNotice("Программа перенесена в архив.");
                      } catch (error) {
                        setError(errorText(error));
                      }
                    }
                  }}
                >
                  В архив
                </Button>
              )}
          </form>
        )}
      </Modal>
      <Modal
        open={!!assignmentProgram}
        title="Назначить программу"
        wide
        onClose={() => setAssignmentProgram(null)}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setAssignmentProgram(null)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              form="program-assignment"
              disabled={!selected.length}
            >
              Назначить ({selected.length})
            </Button>
          </>
        }
      >
        {assignmentProgram && (
          <form id="program-assignment" onSubmit={assign}>
            {error && <div className="alert error">{error}</div>}
            <p>
              <strong>{assignmentProgram.title}</strong>
            </p>
            <p className="muted">
              Каждому выбранному сотруднику будут назначены все курсы программы:{" "}
              {assignmentProgram.courseIds.length}.
            </p>
            <Field label="Срок завершения *">
              <input
                required
                type="date"
                min={today()}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </Field>
            <Field label="Поиск сотрудников">
              <input
                placeholder="ФИО или подразделение"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />
            </Field>
            <div className="actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setSelected([
                    ...new Set([
                      ...selected,
                      ...activeEmployees.map((employee) => employee.id),
                    ]),
                  ])
                }
              >
                Выбрать найденных
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelected([])}
              >
                Очистить
              </Button>
            </div>
            <div style={{ maxHeight: 330, overflowY: "auto" }}>
              {activeEmployees.map((employee) => (
                <label
                  className="check-row"
                  key={employee.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: 12,
                    borderBottom: "1px solid #edf0f4",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(employee.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, employee.id]
                          : selected.filter((id) => id !== employee.id),
                      )
                    }
                  />
                  <span>
                    <strong>{employee.name}</strong>
                    <span className="muted small" style={{ display: "block" }}>
                      {employee.department}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={!!detail}
        title={detail?.title || "Программа"}
        wide
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <p className="muted">{detail.description}</p>
            <h3>Курсы программы</h3>
            {detail.courseIds.map((courseId, index) => {
              const course = state.courses.find(
                (course) => course.id === courseId,
              );
              return (
                course && (
                  <div
                    key={courseId}
                    className="section-heading"
                    style={{
                      padding: "14px 0",
                      borderBottom: "1px solid #edf0f4",
                    }}
                  >
                    <div>
                      <strong>
                        {index + 1}. {course.title}
                      </strong>
                      <p className="muted small">
                        {course.durationHours} ч. · {course.category}
                      </p>
                    </div>
                    <Link
                      className="text-link"
                      to={`/courses/${course.id}`}
                      onClick={() => setDetail(null)}
                    >
                      Открыть
                    </Link>
                  </div>
                )
              );
            })}
            {role === "hr" && (
              <>
                <h3 style={{ marginTop: 25 }}>Прогресс сотрудников</h3>
                {detail.employeeIds.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Сотрудник</th>
                          <th>Прогресс программы</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.employeeIds.map((id) => (
                          <tr key={id}>
                            <td>
                              {state.employees.find(
                                (employee) => employee.id === id,
                              )?.name || "Сотрудник"}
                            </td>
                            <td>
                              <Progress value={calculateProgress(detail, id)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">
                    Программа ещё не назначена сотрудникам.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
