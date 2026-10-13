import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  GraduationCap,
  Plus,
  Users,
} from "lucide-react";
import { useHr } from "../../../store/HrContext";
import { getAssignmentProgress } from "../../../utils/domain";
import type { AssignmentStatus } from "../../../api/types";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeading,
  Progress,
  StatCard,
} from "../../../components/ui";
import {
  exportHrCsv,
  HrAvatar,
  hrDate,
  HrStatus,
  hrToday,
  STATUS_LABELS,
} from "./HrManagementShared";
import "./HrManagement.css";

export default function DashboardPage() {
  const { state } = useHr();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("all");
  const [department, setDepartment] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const departments = [
    ...new Set(state.employees.map((employee) => employee.department)),
  ].sort();
  const today = hrToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const quarterStart = `${today.slice(0, 4)}-${String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  const start =
    period === "month"
      ? monthStart
      : period === "quarter"
        ? quarterStart
        : period === "custom"
          ? dateFrom
          : "";
  const end = period === "custom" ? dateTo : "";
  const records = state.assignments
    .filter((assignment) => !assignment.cancelledAt)
    .map((assignment) => ({
      assignment,
      employee: state.employees.find(
        (employee) => employee.id === assignment.employeeId,
      ),
      course: state.courses.find((course) => course.id === assignment.courseId),
      progress: getAssignmentProgress(state, assignment),
    }))
    .filter(
      ({ assignment, employee }) =>
        (department === "all" || employee?.department === department) &&
        (courseId === "all" || assignment.courseId === courseId) &&
        (!start || assignment.assignedAt.slice(0, 10) >= start) &&
        (!end || assignment.assignedAt.slice(0, 10) <= end),
    );
  const assignmentIds = new Set(records.map((record) => record.assignment.id));
  const peopleCount = new Set(
    records.map((record) => record.assignment.employeeId),
  ).size;
  const completeCount = records.filter(
    (record) => record.progress.isComplete,
  ).length;
  const completionPercent = records.length
    ? Math.round((completeCount / records.length) * 100)
    : 0;
  const submittedAttempts = state.attempts.filter(
    (attempt) =>
      assignmentIds.has(attempt.assignmentId) &&
      attempt.status !== "in_progress",
  );
  const gradedAttempts = submittedAttempts.filter(
    (attempt) => attempt.status === "passed" || attempt.status === "failed",
  );
  const averageScore = gradedAttempts.length
    ? Math.round(
        gradedAttempts.reduce((total, attempt) => total + attempt.percent, 0) /
          gradedAttempts.length,
      )
    : null;
  const pendingCount = submittedAttempts.filter(
    (attempt) => attempt.status === "pending_review",
  ).length;
  const completedLessons = records.reduce(
    (total, record) => total + record.progress.completedLessons,
    0,
  );
  const statusCounts: { status: AssignmentStatus; color: string }[] = [
    { status: "completed", color: "#41a783" },
    { status: "in_progress", color: "#5188df" },
    { status: "not_started", color: "#b7c3d5" },
    { status: "pending_review", color: "#dfb154" },
    { status: "failed", color: "#cd7883" },
    { status: "overdue", color: "#d97e65" },
  ];
  const distribution = statusCounts.map((item) => ({
    ...item,
    count: records.filter((record) => record.progress.status === item.status)
      .length,
  }));
  const maximum = Math.max(1, ...distribution.map((item) => item.count));
  const courseGroups = [
    ...new Set(records.map((record) => record.assignment.courseId)),
  ]
    .map((id) => {
      const matching = records.filter(
        (record) => record.assignment.courseId === id,
      );
      const finished = matching.filter(
        (record) => record.progress.isComplete,
      ).length;
      return {
        id,
        title: matching[0]?.course?.title || "Курс не найден",
        count: matching.length,
        finished,
        percent: Math.round((finished / matching.length) * 100),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const reminderEndDate = new Date(`${today}T12:00:00`);
  reminderEndDate.setDate(
    reminderEndDate.getDate() + state.settings.notificationDaysBefore,
  );
  const reminderEnd = `${reminderEndDate.getFullYear()}-${String(reminderEndDate.getMonth() + 1).padStart(2, "0")}-${String(reminderEndDate.getDate()).padStart(2, "0")}`;
  const deadlines = records
    .filter(
      (record) =>
        !record.progress.isComplete &&
        record.assignment.deadline >= today &&
        record.assignment.deadline <= reminderEnd,
    )
    .sort((a, b) => a.assignment.deadline.localeCompare(b.assignment.deadline));
  const attention = records
    .filter(
      (record) =>
        record.progress.isOverdue ||
        record.progress.status === "pending_review" ||
        record.progress.status === "failed",
    )
    .sort(
      (a, b) =>
        Number(b.progress.isOverdue) - Number(a.progress.isOverdue) ||
        a.assignment.deadline.localeCompare(b.assignment.deadline),
    );
  const exportRows = () =>
    exportHrCsv(
      "SAQ_Обзор_обучения.csv",
      [
        "Сотрудник",
        "Подразделение",
        "Курс",
        "Дата назначения",
        "Срок",
        "Статус",
        "Прогресс, %",
        "Материалов изучено",
        "Результат, %",
      ],
      records.map(({ assignment, employee, course, progress }) => [
        employee?.name,
        employee?.department,
        course?.title,
        hrDate(assignment.assignedAt),
        hrDate(assignment.deadline),
        STATUS_LABELS[progress.status],
        progress.progress,
        progress.completedLessons,
        progress.bestScore ?? "",
      ]),
    );
  return (
    <div className="page">
      <PageHeading
        eyebrow="КАДРОВАЯ СЛУЖБА"
        title="Обзор обучения"
        subtitle="Прогресс сотрудников, результаты тестирования и ближайшие сроки"
        action={
          <>
            <Button
              variant="outline"
              onClick={exportRows}
              disabled={!records.length}
            >
              <Download size={16} />
              Выгрузить отчёт
            </Button>
            <Button onClick={() => navigate("/assignments?create=1")}>
              <Plus size={17} />
              Назначить обучение
            </Button>
          </>
        }
      />
      <section
        className="panel hr-filter-panel"
        aria-label="Фильтры показателей"
      >
        <Field label="Период назначения">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="all">За всё время</option>
            <option value="month">Текущий месяц</option>
            <option value="quarter">Текущий квартал</option>
            <option value="custom">Выбрать период</option>
          </select>
        </Field>
        {period === "custom" && (
          <>
            <Field label="С">
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </Field>
            <Field
              label="По"
              error={
                dateFrom && dateTo && dateFrom > dateTo
                  ? "Дата окончания должна быть не раньше начала."
                  : undefined
              }
            >
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Подразделение">
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="all">Все подразделения</option>
            {departments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Курс">
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
          >
            <option value="all">Все курсы</option>
            {state.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </Field>
      </section>
      <div className="hr-stats">
        <StatCard
          value={peopleCount}
          label="Сотрудников в обучении"
          caption={`Назначений курсов: ${records.length}`}
          icon={<Users size={20} />}
        />
        <StatCard
          value={completeCount}
          label="Завершено обучений"
          caption={`${completionPercent}% от назначений в выборке`}
          tone="green"
          icon={<GraduationCap size={21} />}
        />
        <StatCard
          value={averageScore == null ? "—" : `${averageScore}%`}
          label="Средний результат тестов"
          caption={`Проверенных попыток: ${gradedAttempts.length}`}
          icon={<Award size={20} />}
        />
        <StatCard
          value={records.filter((record) => record.progress.isOverdue).length}
          label="Просроченных назначений"
          caption="Нужны внимание и новый срок"
          tone="amber"
          icon={<CalendarClock size={20} />}
        />
      </div>
      <div className="hr-two-columns">
        <section className="panel">
          <header className="hr-panel-header">
            <div>
              <h3>Статусы обучения</h3>
              <p>Распределение назначений в выбранной группе</p>
            </div>
            <Badge tone="gray">{records.length} назначений</Badge>
          </header>
          <div className="hr-panel-body">
            {records.length ? (
              <>
                <div
                  role="img"
                  aria-label={distribution
                    .map(
                      (item) => `${STATUS_LABELS[item.status]}: ${item.count}`,
                    )
                    .join(", ")}
                >
                  {distribution.map((item) => (
                    <div key={item.status} className="hr-chart-row">
                      <span>{STATUS_LABELS[item.status]}</span>
                      <div className="hr-chart-bar">
                        <span
                          style={{
                            width: `${(item.count / maximum) * 100}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                      <span className="hr-chart-value">{item.count}</span>
                    </div>
                  ))}
                </div>
                <div className="hr-chart-legend">
                  <span>
                    <CheckCircle2 size={13} className="hr-inline-icon" />
                    Изучено материалов: <strong>{completedLessons}</strong>
                  </span>
                  <span>
                    <Award size={13} className="hr-inline-icon" />
                    Сдано попыток: <strong>{submittedAttempts.length}</strong>
                  </span>
                  <Link to="/results?status=pending_review">
                    На проверке: <strong>{pendingCount}</strong>
                  </Link>
                </div>
                <p className="hr-chart-caption">
                  Показатели рассчитаны по фактическим назначениям. Для каждого
                  назначения показан один текущий статус.
                </p>
              </>
            ) : (
              <EmptyState
                title="Нет данных за выбранный период"
                description="Измените период, подразделение или курс."
              />
            )}
          </div>
        </section>
        <section className="panel">
          <header className="hr-panel-header">
            <div>
              <h3>Обучение по курсам</h3>
              <p>Курсы с наибольшим количеством назначений</p>
            </div>
            <Link to="/courses">
              Все курсы <ArrowUpRight size={13} className="hr-inline-icon" />
            </Link>
          </header>
          <div className="hr-panel-body">
            {courseGroups.length ? (
              courseGroups.map((course) => (
                <div className="hr-course-row" key={course.id}>
                  <span className="hr-course-icon">
                    <BookOpen size={17} />
                  </span>
                  <div>
                    <Link to={`/courses/${course.id}`}>
                      <strong>{course.title}</strong>
                    </Link>
                    <small>
                      {course.count} назначений · {course.finished} завершено
                    </small>
                  </div>
                  <div className="hr-completion">
                    <Progress
                      value={course.percent}
                      showLabel={false}
                      tone="green"
                    />
                    <small>{course.percent}% завершено</small>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="Курсы не назначены"
                description="Назначьте обучение или измените фильтры."
              />
            )}
          </div>
        </section>
      </div>
      <section className="panel">
        <header className="hr-panel-header">
          <div>
            <h3>
              Требуют внимания{" "}
              <span className="hr-panel-count">· {attention.length}</span>
            </h3>
            <p>
              Просроченные назначения, несданные тесты и ответы, ожидающие
              проверки
            </p>
          </div>
          <Link to="/assignments">Открыть назначения →</Link>
        </header>
        {attention.length ? (
          <div className="table-wrap hr-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Курс</th>
                  <th>Срок</th>
                  <th>Прогресс</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {attention
                  .slice(0, 6)
                  .map(({ assignment, employee, course, progress }) => (
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
                              {employee?.name || "Сотрудник"}
                            </Link>
                            <small>{employee?.department}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Link
                          className="hr-inline-link"
                          to={`/courses/${assignment.courseId}`}
                        >
                          {course?.title}
                        </Link>
                      </td>
                      <td
                        className={`hr-deadline ${progress.isOverdue ? "is-late" : ""}`}
                      >
                        {hrDate(assignment.deadline)}
                      </td>
                      <td className="hr-compact-progress">
                        <Progress value={progress.progress} />
                      </td>
                      <td>
                        <HrStatus status={progress.status} />
                      </td>
                      <td>
                        <Link
                          className="hr-inline-link"
                          to={
                            progress.lastAttempt?.status === "pending_review"
                              ? `/results?status=pending_review&employee=${assignment.employeeId}&course=${assignment.courseId}`
                              : `/employees?employee=${assignment.employeeId}`
                          }
                        >
                          {progress.lastAttempt?.status === "pending_review"
                            ? "Проверить ответ"
                            : "Открыть карточку"}{" "}
                          →
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Всё под контролем"
            description="В выбранной группе нет просроченных назначений и тестов, требующих внимания."
            icon={<CheckCircle2 size={25} />}
          />
        )}
        {attention.length > 6 && (
          <footer className="hr-table-footer">
            Показаны 6 из {attention.length}. Все назначения доступны в
            соответствующем разделе.
          </footer>
        )}
      </section>
      <section className="panel" style={{ marginTop: 20 }}>
        <header className="hr-panel-header">
          <div>
            <h3>
              Ближайшие сроки{" "}
              <span className="hr-panel-count">· {deadlines.length}</span>
            </h3>
            <p>
              {state.settings.notificationDaysBefore
                ? `Обучение нужно завершить в течение ${state.settings.notificationDaysBefore} дн.`
                : "Обучение нужно завершить сегодня"}
            </p>
          </div>
          <Link to="/settings">Настроить период →</Link>
        </header>
        <div className="hr-panel-body">
          {deadlines.length ? (
            deadlines
              .slice(0, 5)
              .map(({ assignment, employee, course, progress }) => (
                <div className="hr-course-row" key={assignment.id}>
                  <span className="hr-course-icon">
                    <CalendarClock size={17} />
                  </span>
                  <div>
                    <Link to={`/employees?employee=${assignment.employeeId}`}>
                      <strong>{employee?.name}</strong>
                    </Link>
                    <small>{course?.title}</small>
                  </div>
                  <div className="hr-completion">
                    <Progress value={progress.progress} showLabel={false} />
                    <small>{progress.progress}% пройдено</small>
                  </div>
                  <span className="hr-deadline">
                    {hrDate(assignment.deadline)}
                  </span>
                </div>
              ))
          ) : (
            <p className="hr-form-note">
              В выбранной группе ближайших сроков нет.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
