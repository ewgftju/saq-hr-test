import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, Download, Plus, Search, X } from "lucide-react";
import { useHr } from "../../../store/HrContext";
import { getAssignmentProgress } from "../../../utils/domain";
import type { Assignment } from "../../../api/types";
import {
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  Progress,
} from "../../../components/ui";
import {
  exportHrCsv,
  HrAvatar,
  HrFeedback,
  hrDate,
  HrStatus,
  hrToday,
  STATUS_LABELS,
} from "./HrManagementShared";
import "./HrManagement.css";

export default function AssignmentsPage() {
  const { state, assignCourses, changeAssignmentDeadline, cancelAssignment } =
    useHr();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    params.get("status") || "active",
  );
  const [courseFilter, setCourseFilter] = useState(
    params.get("course") || "all",
  );
  const [department, setDepartment] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(params.get("create") === "1");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(
    params.get("employee") ? [params.get("employee")!] : [],
  );
  const [selectedCourses, setSelectedCourses] = useState<string[]>(
    params.get("course") ? [params.get("course")!] : [],
  );
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [deadline, setDeadline] = useState("");
  const [required, setRequired] = useState(true);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Assignment | null>(null);
  const [newDeadline, setNewDeadline] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const departments = [
    ...new Set(state.employees.map((employee) => employee.department)),
  ].sort();
  const activeEmployees = state.employees.filter(
    (employee) => employee.status === "active",
  );
  const publishedCourses = state.courses.filter(
    (course) => course.status === "published",
  );
  const candidateEmployees = activeEmployees.filter((employee) =>
    `${employee.name} ${employee.department} ${employee.email}`
      .toLowerCase()
      .includes(employeeSearch.toLowerCase()),
  );
  const candidateCourses = publishedCourses.filter((course) =>
    `${course.title} ${course.category}`
      .toLowerCase()
      .includes(courseSearch.toLowerCase()),
  );
  const records = state.assignments.map((assignment) => ({
    assignment,
    employee: state.employees.find(
      (employee) => employee.id === assignment.employeeId,
    ),
    course: state.courses.find((course) => course.id === assignment.courseId),
    progress: getAssignmentProgress(state, assignment),
  }));
  const rows = records
    .filter(({ assignment, employee, course, progress }) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? !assignment.cancelledAt
          : statusFilter === "cancelled"
            ? Boolean(assignment.cancelledAt)
            : !assignment.cancelledAt &&
              (statusFilter === "overdue"
                ? progress.isOverdue
                : progress.status === statusFilter));
      return (
        matchesStatus &&
        (courseFilter === "all" || assignment.courseId === courseFilter) &&
        (department === "all" || employee?.department === department) &&
        `${employee?.name || ""} ${employee?.email || ""} ${course?.title || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) =>
      (a.assignment.deadline || "9999").localeCompare(
        b.assignment.deadline || "9999",
      ),
    );
  const pageCount = Math.max(1, Math.ceil(rows.length / 12));
  const currentPage = Math.min(page, pageCount);
  const shown = rows.slice((currentPage - 1) * 12, currentPage * 12);
  const selectedValidEmployees = selectedEmployees.filter((id) =>
    activeEmployees.some((employee) => employee.id === id),
  );
  const selectedValidCourses = selectedCourses.filter((id) =>
    publishedCourses.some((course) => course.id === id),
  );
  const existingCount = selectedValidEmployees.reduce(
    (total, employeeId) =>
      total +
      selectedValidCourses.filter((courseId) =>
        state.assignments.some(
          (assignment) =>
            !assignment.cancelledAt &&
            assignment.employeeId === employeeId &&
            assignment.courseId === courseId,
        ),
      ).length,
    0,
  );
  const newCount =
    selectedValidEmployees.length * selectedValidCourses.length - existingCount;
  const toggle = (values: string[], id: string) =>
    values.includes(id)
      ? values.filter((value) => value !== id)
      : [...values, id];
  const closeCreate = () => {
    setCreateOpen(false);
    setError("");
  };
  const openCreate = () => {
    setSelectedEmployees([]);
    setSelectedCourses([]);
    setEmployeeSearch("");
    setCourseSearch("");
    setDeadline("");
    setRequired(true);
    setError("");
    setCreateOpen(true);
  };
  const create = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (!selectedValidEmployees.length)
        throw new Error("Выберите хотя бы одного активного сотрудника.");
      if (!selectedValidCourses.length)
        throw new Error("Выберите хотя бы один опубликованный курс.");
      if (!deadline || deadline < hrToday())
        throw new Error("Укажите срок не раньше сегодняшней даты.");
      if (!newCount)
        throw new Error("Все выбранные курсы уже назначены этим сотрудникам.");
      const count = assignCourses({
        employeeIds: selectedValidEmployees,
        courseIds: selectedValidCourses,
        deadline,
        required,
      });
      setFeedback(
        `Создано назначений: ${count}.${existingCount ? ` Уже существующие назначения (${existingCount}) пропущены.` : ""}`,
      );
      closeCreate();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось назначить обучение.",
      );
    }
  };
  const saveDeadline = (event: FormEvent) => {
    event.preventDefault();
    if (!editAssignment) return;
    try {
      if (!newDeadline || newDeadline < hrToday())
        throw new Error("Новый срок не может быть раньше сегодняшней даты.");
      changeAssignmentDeadline(editAssignment.id, newDeadline);
      setFeedback("Срок обучения изменён.");
      setEditAssignment(null);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось изменить срок.",
      );
    }
  };
  const exportRows = () =>
    exportHrCsv(
      "SAQ_Назначения.csv",
      [
        "Сотрудник",
        "Подразделение",
        "Курс",
        "Назначено",
        "Срок",
        "Обязательный",
        "Статус",
        "Прогресс, %",
        "Лучший результат, %",
        "Завершено",
      ],
      rows.map(({ assignment, employee, course, progress }) => [
        employee?.name,
        employee?.department,
        course?.title,
        hrDate(assignment.assignedAt),
        hrDate(assignment.deadline),
        assignment.required ? "Да" : "Нет",
        assignment.cancelledAt ? "Отменён" : STATUS_LABELS[progress.status],
        progress.progress,
        progress.bestScore ?? "",
        hrDate(assignment.completedAt),
      ]),
    );
  return (
    <div className="page">
      <PageHeading
        title="Назначения на обучение"
        subtitle="Управляйте обучением сотрудников и контролируйте сроки прохождения"
        action={
          <>
            <Button
              variant="outline"
              onClick={exportRows}
              disabled={!rows.length}
            >
              <Download size={16} />
              Экспорт
            </Button>
            <Button onClick={openCreate}>
              <Plus size={17} />
              Назначить обучение
            </Button>
          </>
        }
      />
      <HrFeedback message={feedback} />
      <section className="panel">
        <div className="hr-table-tools">
          <label className="hr-search">
            <span className="sr-only">Поиск по сотруднику или курсу</span>
            <Search size={16} />
            <input
              value={search}
              placeholder="Сотрудник или название курса"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Подразделение"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Все подразделения</option>
            {departments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Курс"
            value={courseFilter}
            onChange={(event) => {
              setCourseFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Все курсы</option>
            {state.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Статус назначения"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="active">Действующие</option>
            <option value="all">Все назначения</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="cancelled">Отменён</option>
          </select>
        </div>
        {shown.length ? (
          <div className="table-wrap hr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Курс</th>
                  <th>Срок обучения</th>
                  <th>Прогресс</th>
                  <th>Результат</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ assignment, employee, course, progress }) => (
                  <tr key={assignment.id}>
                    <td>
                      <div className="hr-person-cell">
                        <HrAvatar
                          name={employee?.name || "?"}
                          color={employee?.avatarColor}
                        />
                        <div>
                          <Link
                            to={`/employees?employee=${assignment.employeeId}`}
                          >
                            {employee?.name || "Сотрудник не найден"}
                          </Link>
                          <small>{employee?.department}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link
                        to={`/courses/${assignment.courseId}`}
                        className="hr-inline-link"
                      >
                        {course?.title || "Курс не найден"}
                      </Link>
                      <span className="hr-subtext">
                        {assignment.required
                          ? "Обязательное обучение"
                          : "Рекомендованное обучение"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`hr-deadline ${progress.isOverdue && !assignment.cancelledAt ? "is-late" : ""}`}
                      >
                        {hrDate(assignment.deadline)}
                      </span>
                      <span className="hr-subtext">
                        Назначен {hrDate(assignment.assignedAt)}
                      </span>
                    </td>
                    <td className="hr-compact-progress">
                      <Progress
                        value={progress.progress}
                        tone={progress.isComplete ? "green" : "blue"}
                      />
                    </td>
                    <td className="hr-score-cell">
                      {progress.bestScore == null
                        ? "—"
                        : `${Math.round(progress.bestScore)}%`}
                      {course?.testId && (
                        <Link
                          className="hr-subtext"
                          to={`/results?employee=${assignment.employeeId}&course=${assignment.courseId}`}
                        >
                          Попытки:{" "}
                          {
                            state.attempts.filter(
                              (attempt) =>
                                attempt.assignmentId === assignment.id &&
                                attempt.status !== "in_progress",
                            ).length
                          }
                        </Link>
                      )}
                    </td>
                    <td>
                      <HrStatus
                        status={progress.status}
                        cancelled={Boolean(assignment.cancelledAt)}
                      />
                    </td>
                    <td>
                      <div className="hr-row-actions">
                        {!assignment.cancelledAt && !progress.isComplete ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditAssignment(assignment);
                                setNewDeadline(assignment.deadline);
                                setError("");
                              }}
                              aria-label={`Изменить срок: ${employee?.name}, ${course?.title}`}
                            >
                              <CalendarClock size={15} />
                              Срок
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCancelTarget(assignment);
                                setError("");
                              }}
                              aria-label={`Отменить назначение: ${employee?.name}, ${course?.title}`}
                            >
                              <X size={15} />
                            </Button>
                          </>
                        ) : (
                          <span className="hr-muted-label">—</span>
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
            title="Назначения не найдены"
            description={
              search ||
              department !== "all" ||
              courseFilter !== "all" ||
              statusFilter !== "active"
                ? "Измените условия поиска или выбранные фильтры."
                : "Выберите сотрудников, курсы и срок прохождения обучения."
            }
            action={
              !state.assignments.length ? (
                <Button onClick={openCreate}>
                  <Plus size={16} />
                  Назначить обучение
                </Button>
              ) : undefined
            }
          />
        )}
        <footer className="hr-table-footer">
          <span>
            Найдено: {rows.length}
            {rows.length
              ? ` · Показаны ${(currentPage - 1) * 12 + 1}–${Math.min(currentPage * 12, rows.length)}`
              : ""}
          </span>
          <div className="actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Назад
            </Button>
            <span>
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Далее
            </Button>
          </div>
        </footer>
      </section>
      <Modal
        open={createOpen}
        title="Назначить обучение"
        onClose={closeCreate}
        wide
        footer={
          <>
            <Button variant="outline" onClick={closeCreate}>
              Отмена
            </Button>
            <Button type="submit" form="hr-assign-form" disabled={!newCount}>
              Назначить{newCount ? ` · ${newCount}` : ""}
            </Button>
          </>
        }
      >
        <form id="hr-assign-form" onSubmit={create} className="hr-modal-form">
          <HrFeedback message={error} error />
          <div className="hr-multiselects">
            <section className="hr-select-box">
              <header>
                <strong>
                  Сотрудники{" "}
                  <span className="hr-counter">
                    ({selectedValidEmployees.length})
                  </span>
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedEmployees(
                      candidateEmployees.every((employee) =>
                        selectedEmployees.includes(employee.id),
                      )
                        ? selectedEmployees.filter(
                            (id) =>
                              !candidateEmployees.some(
                                (employee) => employee.id === id,
                              ),
                          )
                        : [
                            ...new Set([
                              ...selectedEmployees,
                              ...candidateEmployees.map(
                                (employee) => employee.id,
                              ),
                            ]),
                          ],
                    )
                  }
                >
                  {candidateEmployees.length &&
                  candidateEmployees.every((employee) =>
                    selectedEmployees.includes(employee.id),
                  )
                    ? "Снять выбор"
                    : "Выбрать найденных"}
                </button>
              </header>
              <div className="hr-select-search">
                <input
                  aria-label="Поиск сотрудников для назначения"
                  placeholder="ФИО или подразделение"
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                />
              </div>
              <div className="hr-select-list">
                {candidateEmployees.map((employee) => (
                  <label className="hr-select-item" key={employee.id}>
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee.id)}
                      onChange={() =>
                        setSelectedEmployees(
                          toggle(selectedEmployees, employee.id),
                        )
                      }
                    />
                    <span>
                      {employee.name}
                      <small>
                        {employee.department} · {employee.position}
                      </small>
                    </span>
                  </label>
                ))}
                {!candidateEmployees.length && (
                  <div className="hr-empty-inline">
                    Активные сотрудники не найдены.
                  </div>
                )}
              </div>
            </section>
            <section className="hr-select-box">
              <header>
                <strong>
                  Курсы{" "}
                  <span className="hr-counter">
                    ({selectedValidCourses.length})
                  </span>
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCourses(
                      candidateCourses.every((course) =>
                        selectedCourses.includes(course.id),
                      )
                        ? selectedCourses.filter(
                            (id) =>
                              !candidateCourses.some(
                                (course) => course.id === id,
                              ),
                          )
                        : [
                            ...new Set([
                              ...selectedCourses,
                              ...candidateCourses.map((course) => course.id),
                            ]),
                          ],
                    )
                  }
                >
                  {candidateCourses.length &&
                  candidateCourses.every((course) =>
                    selectedCourses.includes(course.id),
                  )
                    ? "Снять выбор"
                    : "Выбрать найденные"}
                </button>
              </header>
              <div className="hr-select-search">
                <input
                  aria-label="Поиск курсов для назначения"
                  placeholder="Название курса"
                  value={courseSearch}
                  onChange={(event) => setCourseSearch(event.target.value)}
                />
              </div>
              <div className="hr-select-list">
                {candidateCourses.map((course) => (
                  <label className="hr-select-item" key={course.id}>
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course.id)}
                      onChange={() =>
                        setSelectedCourses(toggle(selectedCourses, course.id))
                      }
                    />
                    <span>
                      {course.title}
                      <small>
                        {course.category} · {course.durationHours} ч.
                      </small>
                    </span>
                  </label>
                ))}
                {!candidateCourses.length && (
                  <div className="hr-empty-inline">
                    Опубликованные курсы не найдены.
                  </div>
                )}
              </div>
            </section>
          </div>
          <div className="form-grid">
            <Field label="Пройти до" required>
              <input
                type="date"
                min={hrToday()}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                required
              />
            </Field>
            <div>
              <span className="hr-search-input-label">Условия прохождения</span>
              <label className="hr-check">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(event) => setRequired(event.target.checked)}
                />
                Обязательное обучение
              </label>
            </div>
          </div>
          <div className="hr-selection-summary">
            Выбрано сотрудников:{" "}
            <strong>{selectedValidEmployees.length}</strong> · Курсов:{" "}
            <strong>{selectedValidCourses.length}</strong> · Новых назначений:{" "}
            <strong>{newCount}</strong>
            {existingCount > 0 && (
              <>
                <br />
                Совпадающих назначений: {existingCount}. Повторные назначения
                будут пропущены.
              </>
            )}
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(editAssignment)}
        title="Изменить срок обучения"
        onClose={() => {
          setEditAssignment(null);
          setError("");
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditAssignment(null);
                setError("");
              }}
            >
              Отмена
            </Button>
            <Button type="submit" form="hr-deadline-form">
              Сохранить срок
            </Button>
          </>
        }
      >
        <form
          id="hr-deadline-form"
          onSubmit={saveDeadline}
          className="hr-modal-form"
        >
          <HrFeedback message={error} error />
          <p className="hr-form-note">
            {
              state.employees.find(
                (employee) => employee.id === editAssignment?.employeeId,
              )?.name
            }
            <br />
            {
              state.courses.find(
                (course) => course.id === editAssignment?.courseId,
              )?.title
            }
          </p>
          <Field label="Новый срок" required>
            <input
              type="date"
              value={newDeadline}
              min={hrToday()}
              onChange={(event) => setNewDeadline(event.target.value)}
              required
            />
          </Field>
        </form>
      </Modal>
      <Modal
        open={Boolean(cancelTarget)}
        title="Отменить назначение?"
        onClose={() => {
          setCancelTarget(null);
          setError("");
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null);
                setError("");
              }}
            >
              Оставить назначение
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!cancelTarget) return;
                try {
                  cancelAssignment(cancelTarget.id);
                  setFeedback(
                    "Назначение отменено. История прохождения сохранена.",
                  );
                  setCancelTarget(null);
                  setError("");
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Не удалось отменить назначение.",
                  );
                }
              }}
            >
              Отменить обучение
            </Button>
          </>
        }
      >
        <HrFeedback message={error} error />
        <p>
          {
            state.employees.find(
              (employee) => employee.id === cancelTarget?.employeeId,
            )?.name
          }
        </p>
        <p className="hr-form-note">
          Курс «
          {
            state.courses.find((course) => course.id === cancelTarget?.courseId)
              ?.title
          }
          » будет снят с назначенного обучения. Результаты и история попыток
          сохранятся.
        </p>
      </Modal>
    </div>
  );
}
