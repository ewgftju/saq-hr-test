import { useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Download,
  Mail,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { useHr } from "../../../store/HrContext";
import { getAssignmentProgress } from "../../../utils/domain";
import type { Employee } from "../../../api/types";
import {
  Badge,
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
  STATUS_LABELS,
} from "./HrManagementShared";
import "./HrManagement.css";

const emptyEmployee: Employee = {
  id: "",
  name: "",
  email: "",
  department: "",
  position: "",
  status: "active",
};

export default function EmployeesPage() {
  const { state, saveEmployee } = useHr();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const routeParams = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Employee | null>(null);
  const [deactivate, setDeactivate] = useState<Employee | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const departments = [
    ...new Set(state.employees.map((employee) => employee.department)),
  ].sort();
  const profileId = params.get("employee") || routeParams.id;
  const profile = state.employees.find((employee) => employee.id === profileId);
  const rows = state.employees
    .filter(
      (employee) =>
        (department === "all" || employee.department === department) &&
        (status === "all" || employee.status === status) &&
        `${employee.name} ${employee.email} ${employee.position}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const pageCount = Math.max(1, Math.ceil(rows.length / 12));
  const currentPage = Math.min(page, pageCount);
  const shown = rows.slice((currentPage - 1) * 12, currentPage * 12);
  const employeeData = (employeeId: string) => {
    const assignments = state.assignments.filter(
      (assignment) =>
        assignment.employeeId === employeeId && !assignment.cancelledAt,
    );
    const progresses = assignments.map((assignment) =>
      getAssignmentProgress(state, assignment),
    );
    const scores = progresses.flatMap((progress) =>
      progress.bestScore == null ? [] : [progress.bestScore],
    );
    return {
      total: assignments.length,
      completed: progresses.filter((progress) => progress.isComplete).length,
      active: progresses.filter((progress) => !progress.isComplete).length,
      overdue: progresses.filter((progress) => progress.isOverdue).length,
      average: scores.length
        ? Math.round(
            scores.reduce((sum, score) => sum + score, 0) / scores.length,
          )
        : null,
      progress: progresses.length
        ? Math.round(
            progresses.reduce((sum, progress) => sum + progress.progress, 0) /
              progresses.length,
          )
        : 0,
    };
  };
  const closeProfile = () => {
    if (routeParams.id) navigate("/employees");
    else {
      const next = new URLSearchParams(params);
      next.delete("employee");
      setParams(next);
    }
  };
  const openProfile = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("employee", id);
    setParams(next);
  };
  const startEdit = (employee: Employee) => {
    closeProfile();
    setForm({ ...employee });
    setError("");
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    try {
      const prepared = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        position: form.position.trim(),
      };
      if (
        !prepared.name ||
        !prepared.email ||
        !prepared.department ||
        !prepared.position
      )
        throw new Error(
          "Заполните ФИО, электронную почту, подразделение и должность.",
        );
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prepared.email))
        throw new Error("Введите корректный адрес электронной почты.");
      if (
        state.employees.some(
          (employee) =>
            employee.id !== prepared.id &&
            employee.email.toLowerCase() === prepared.email.toLowerCase(),
        )
      )
        throw new Error(
          "Сотрудник с таким адресом электронной почты уже существует.",
        );
      if (
        prepared.seniorityYears != null &&
        (prepared.seniorityYears < 0 || prepared.seniorityYears > 70)
      )
        throw new Error("Стаж должен быть от 0 до 70 лет.");
      saveEmployee(prepared);
      setFeedback(
        form.id
          ? "Карточка сотрудника обновлена."
          : "Сотрудник добавлен. Теперь ему можно назначить обучение.",
      );
      setForm(null);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить сотрудника.",
      );
    }
  };
  const exportEmployees = () =>
    exportHrCsv(
      "SAQ_Сотрудники.csv",
      [
        "ФИО",
        "Email",
        "Подразделение",
        "Должность",
        "Статус",
        "Назначено курсов",
        "Завершено",
        "Просрочено",
        "Средний результат, %",
      ],
      rows.map((employee) => {
        const data = employeeData(employee.id);
        return [
          employee.name,
          employee.email,
          employee.department,
          employee.position,
          employee.status === "active" ? "Активен" : "Неактивен",
          data.total,
          data.completed,
          data.overdue,
          data.average ?? "",
        ];
      }),
    );
  const profileAssignments = profile
    ? state.assignments
        .filter((assignment) => assignment.employeeId === profile.id)
        .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
    : [];
  const profileAttempts = profile
    ? state.attempts
        .filter((attempt) => attempt.employeeId === profile.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    : [];
  const profileData = profile ? employeeData(profile.id) : undefined;
  const exportProfile = () => {
    if (!profile) return;
    exportHrCsv(
      `SAQ_Обучение_${profile.name.replace(/[^\p{L}\p{N}]+/gu, "_")}.csv`,
      [
        "Сотрудник",
        "Курс",
        "Срок",
        "Статус",
        "Уроков завершено",
        "Всего уроков",
        "Лучший результат, %",
        "Попыток",
        "Дата завершения",
      ],
      profileAssignments.map((assignment) => {
        const progress = getAssignmentProgress(state, assignment);
        return [
          profile.name,
          state.courses.find((course) => course.id === assignment.courseId)
            ?.title,
          hrDate(assignment.deadline),
          assignment.cancelledAt ? "Отменён" : STATUS_LABELS[progress.status],
          progress.completedLessons,
          progress.totalLessons,
          progress.bestScore ?? "",
          profileAttempts.filter(
            (attempt) => attempt.assignmentId === assignment.id,
          ).length,
          hrDate(assignment.completedAt),
        ];
      }),
    );
  };
  return (
    <div className="page">
      <PageHeading
        title="Сотрудники"
        subtitle="Карточки сотрудников и персональная история обучения"
        action={
          <>
            <Button
              variant="outline"
              onClick={exportEmployees}
              disabled={!rows.length}
            >
              <Download size={16} />
              Экспорт
            </Button>
            <Button
              onClick={() => {
                setForm({ ...emptyEmployee });
                setError("");
              }}
            >
              <Plus size={17} />
              Добавить сотрудника
            </Button>
          </>
        }
      />
      <HrFeedback message={feedback} />
      <section className="panel">
        <div className="hr-table-tools">
          <label className="hr-search">
            <span className="sr-only">Поиск сотрудника</span>
            <Search size={16} />
            <input
              value={search}
              placeholder="ФИО, должность или email"
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
            aria-label="Статус сотрудника"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="active">Активные сотрудники</option>
            <option value="inactive">Неактивные сотрудники</option>
            <option value="all">Все сотрудники</option>
          </select>
        </div>
        {shown.length ? (
          <div className="table-wrap hr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Подразделение / должность</th>
                  <th>Курсы</th>
                  <th>Общий прогресс</th>
                  <th>Средний результат</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((employee) => {
                  const data = employeeData(employee.id);
                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="hr-person-cell">
                          <HrAvatar
                            name={employee.name}
                            color={employee.avatarColor}
                          />
                          <div>
                            <button
                              className="hr-row-name"
                              onClick={() => openProfile(employee.id)}
                            >
                              {employee.name}
                            </button>
                            <small>{employee.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {employee.department}
                        <span className="hr-subtext">{employee.position}</span>
                      </td>
                      <td>
                        <span className="hr-no-wrap">
                          {data.completed} из {data.total} завершено
                        </span>
                        {data.overdue > 0 && (
                          <span className="hr-subtext hr-deadline is-late">
                            Просрочено: {data.overdue}
                          </span>
                        )}
                      </td>
                      <td className="hr-compact-progress">
                        <Progress
                          value={data.progress}
                          tone={
                            data.total > 0 && data.total === data.completed
                              ? "green"
                              : "blue"
                          }
                        />
                      </td>
                      <td className="hr-score-cell">
                        {data.average == null ? "—" : `${data.average}%`}
                      </td>
                      <td>
                        <Badge
                          tone={employee.status === "active" ? "green" : "gray"}
                        >
                          {employee.status === "active"
                            ? "Активен"
                            : "Неактивен"}
                        </Badge>
                      </td>
                      <td>
                        <div className="hr-row-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openProfile(employee.id)}
                          >
                            Карточка
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Редактировать ${employee.name}`}
                            onClick={() => {
                              setForm({ ...employee });
                              setError("");
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Сотрудники не найдены"
            description={
              state.employees.length
                ? "Измените запрос или выберите другое подразделение."
                : "Добавьте сотрудников, чтобы назначать им курсы и отслеживать результаты."
            }
            icon={<Users size={28} />}
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
        open={Boolean(profileId) && !form && !deactivate}
        title="Карточка сотрудника"
        onClose={closeProfile}
        wide
        footer={
          profile ? (
            <>
              <Button
                variant="outline"
                onClick={exportProfile}
                disabled={!profileAssignments.length}
              >
                <Download size={15} />
                Выгрузить историю
              </Button>
              <Button variant="outline" onClick={() => startEdit(profile)}>
                <Pencil size={15} />
                Редактировать
              </Button>
              {profile.status === "active" ? (
                <Button
                  onClick={() =>
                    navigate(`/assignments?create=1&employee=${profile.id}`)
                  }
                >
                  <Plus size={15} />
                  Назначить курс
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="outline" onClick={closeProfile}>
              Закрыть
            </Button>
          )
        }
      >
        {profile && profileData ? (
          <>
            <header className="hr-profile-heading">
              <HrAvatar name={profile.name} color={profile.avatarColor} />
              <div>
                <h3>{profile.name}</h3>
                <p>{profile.position}</p>
              </div>
              <Badge tone={profile.status === "active" ? "green" : "gray"}>
                {profile.status === "active" ? "Активен" : "Неактивен"}
              </Badge>
            </header>
            <dl className="hr-profile-facts">
              <div>
                <dt>Подразделение</dt>
                <dd>{profile.department}</dd>
              </div>
              <div>
                <dt>Электронная почта</dt>
                <dd>
                  <Mail size={13} className="hr-inline-icon" />
                  {profile.email}
                </dd>
              </div>
              <div>
                <dt>Дата приёма</dt>
                <dd>{hrDate(profile.hiredAt)}</dd>
              </div>
              <div>
                <dt>Стаж работы</dt>
                <dd>
                  {profile.seniorityYears == null
                    ? "Не указан"
                    : `${profile.seniorityYears} лет`}
                </dd>
              </div>
            </dl>
            <div className="hr-mini-stats">
              <div>
                <strong>{profileData.total}</strong>
                <small>Назначено курсов</small>
              </div>
              <div>
                <strong>{profileData.completed}</strong>
                <small>Завершено</small>
              </div>
              <div>
                <strong>{profileData.overdue}</strong>
                <small>Просрочено</small>
              </div>
              <div>
                <strong>
                  {profileData.average == null
                    ? "—"
                    : `${profileData.average}%`}
                </strong>
                <small>Средний результат</small>
              </div>
            </div>
            <h4 className="hr-profile-section-title">Обучение сотрудника</h4>
            {profileAssignments.length ? (
              <div className="table-wrap hr-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Курс</th>
                      <th>Срок</th>
                      <th>Прогресс</th>
                      <th>Результат</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileAssignments.map((assignment) => {
                      const course = state.courses.find(
                        (course) => course.id === assignment.courseId,
                      );
                      const progress = getAssignmentProgress(state, assignment);
                      return (
                        <tr key={assignment.id}>
                          <td className="hr-profile-course">
                            <Link to={`/courses/${assignment.courseId}`}>
                              {course?.title || "Курс не найден"}
                            </Link>
                            <span className="hr-subtext">
                              Материалов: {progress.completedLessons} из{" "}
                              {progress.totalLessons}
                              {assignment.completedAt
                                ? ` · Завершён ${hrDate(assignment.completedAt)}`
                                : ""}
                            </span>
                          </td>
                          <td
                            className={`hr-deadline ${progress.isOverdue && !assignment.cancelledAt ? "is-late" : ""}`}
                          >
                            {hrDate(assignment.deadline)}
                          </td>
                          <td className="hr-compact-progress">
                            <Progress value={progress.progress} />
                          </td>
                          <td>
                            {progress.bestScore == null
                              ? "—"
                              : `${Math.round(progress.bestScore)}%`}
                          </td>
                          <td>
                            <HrStatus
                              status={progress.status}
                              cancelled={Boolean(assignment.cancelledAt)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Курсы ещё не назначены"
                description="Назначьте сотруднику первый курс обучения."
              />
            )}
            <h4 className="hr-profile-section-title">
              История тестирования · {profileAttempts.length}
            </h4>
            {profileAttempts.length ? (
              <div className="hr-attempts-list">
                {profileAttempts.map((attempt) => (
                  <div key={attempt.id} className="hr-attempt-row">
                    <div>
                      <strong>{attempt.testSnapshot.title}</strong>
                      <small>
                        Попытка {attempt.number} ·{" "}
                        {hrDate(attempt.submittedAt || attempt.startedAt, true)}
                      </small>
                      <span className="hr-subtext">
                        {attempt.status === "passed"
                          ? "Тест сдан"
                          : attempt.status === "failed"
                            ? "Тест не сдан"
                            : attempt.status === "pending_review"
                              ? "Ожидает проверки"
                              : "Выполняется"}
                      </span>
                    </div>
                    <div className="hr-attempt-score">
                      {attempt.status === "in_progress" ||
                      attempt.status === "pending_review"
                        ? "—"
                        : `${Math.round(attempt.percent)}%`}
                      <small>
                        {attempt.status === "pending_review"
                          ? "Требуется оценка"
                          : `${attempt.score} / ${attempt.maxScore} баллов`}
                      </small>
                      <Link
                        to={`/results?attempt=${attempt.id}&employee=${profile.id}&course=${attempt.courseId}`}
                        className="hr-inline-link"
                      >
                        Подробнее →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hr-form-note">
                Сотрудник ещё не приступал к тестированию.
              </p>
            )}
            <div className="actions" style={{ marginTop: 24 }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setDeactivate(profile);
                  setError("");
                }}
              >
                {profile.status === "active" ? (
                  <>
                    <UserMinus size={16} />
                    Деактивировать сотрудника
                  </>
                ) : (
                  <>
                    <UserCheck size={16} />
                    Активировать сотрудника
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            title="Сотрудник не найден"
            description="Возможно, карточка недоступна или ссылка устарела."
          />
        )}
      </Modal>
      <Modal
        open={Boolean(form)}
        title={form?.id ? "Редактировать сотрудника" : "Добавить сотрудника"}
        onClose={() => {
          setForm(null);
          setError("");
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setForm(null);
                setError("");
              }}
            >
              Отмена
            </Button>
            <Button type="submit" form="hr-employee-form">
              {form?.id ? "Сохранить" : "Добавить сотрудника"}
            </Button>
          </>
        }
      >
        {form && (
          <form id="hr-employee-form" onSubmit={save} className="hr-modal-form">
            <HrFeedback message={error} error />
            <Field label="Фамилия, имя, отчество" required>
              <input
                value={form.name}
                maxLength={160}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Электронная почта" required>
                <input
                  type="email"
                  value={form.email}
                  maxLength={180}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Подразделение" required>
                <input
                  list="hr-departments"
                  value={form.department}
                  maxLength={150}
                  onChange={(event) =>
                    setForm({ ...form, department: event.target.value })
                  }
                  required
                />
                <datalist id="hr-departments">
                  {departments.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </Field>
              <Field label="Должность" required>
                <input
                  value={form.position}
                  maxLength={150}
                  onChange={(event) =>
                    setForm({ ...form, position: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Дата приёма">
                <input
                  type="date"
                  value={form.hiredAt || ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      hiredAt: event.target.value || undefined,
                    })
                  }
                />
              </Field>
              <Field label="Стаж работы, лет">
                <input
                  type="number"
                  min="0"
                  max="70"
                  step="0.5"
                  value={form.seniorityYears ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      seniorityYears:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <p className="hr-form-note">
              Карточка используется для назначения обучения и учёта результатов.
              История обучения сохраняется при редактировании.
            </p>
          </form>
        )}
      </Modal>
      <Modal
        open={Boolean(deactivate)}
        title={
          deactivate?.status === "active"
            ? "Деактивировать сотрудника?"
            : "Активировать сотрудника?"
        }
        onClose={() => {
          setDeactivate(null);
          setError("");
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDeactivate(null);
                setError("");
              }}
            >
              Отмена
            </Button>
            <Button
              variant={deactivate?.status === "active" ? "danger" : "primary"}
              onClick={() => {
                if (!deactivate) return;
                try {
                  saveEmployee({
                    ...deactivate,
                    status:
                      deactivate.status === "active" ? "inactive" : "active",
                  });
                  setFeedback(
                    deactivate.status === "active"
                      ? "Сотрудник деактивирован. История обучения сохранена."
                      : "Сотрудник снова активен.",
                  );
                  setDeactivate(null);
                  setError("");
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Не удалось изменить статус.",
                  );
                }
              }}
            >
              {deactivate?.status === "active"
                ? "Деактивировать"
                : "Активировать"}
            </Button>
          </>
        }
      >
        <HrFeedback message={error} error />
        <p>{deactivate?.name}</p>
        <p className="hr-form-note">
          {deactivate?.status === "active"
            ? "Новые курсы этому сотруднику назначать будет нельзя. Его карточка, назначения и результаты останутся в истории."
            : "Сотруднику снова можно будет назначать обучение."}
        </p>
      </Modal>
    </div>
  );
}
