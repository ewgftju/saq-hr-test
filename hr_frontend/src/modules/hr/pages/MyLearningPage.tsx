import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Search,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Progress,
} from "../../../components/ui";
import { useHr } from "../../../store/HrContext";
import { getAssignmentProgress, getCertificate } from "../../../utils/domain";
import {
  dateLabel,
  errorText,
  LearningBadge,
  printCertificate,
} from "./CourseShared";

export default function MyLearningPage() {
  const { state, employeeId } = useHr();
  const [tab, setTab] = useState<"active" | "completed" | "all">("active");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const employee = state.employees.find(
    (employee) => employee.id === employeeId,
  );
  const assignments = state.assignments.filter(
    (assignment) =>
      assignment.employeeId === employeeId && !assignment.cancelledAt,
  );
  const completeCount = assignments.filter(
    (assignment) => getAssignmentProgress(state, assignment).isComplete,
  ).length;
  const overdueCount = assignments.filter(
    (assignment) => getAssignmentProgress(state, assignment).isOverdue,
  ).length;
  const rows = assignments
    .map((assignment) => ({
      assignment,
      course: state.courses.find((course) => course.id === assignment.courseId),
      progress: getAssignmentProgress(state, assignment),
      certificate: getCertificate(state, assignment),
    }))
    .filter(
      (row) =>
        row.course &&
        (tab === "all" ||
          (tab === "completed"
            ? row.progress.isComplete
            : !row.progress.isComplete)) &&
        row.course.title.toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <>
      <PageHeading
        title="Моё обучение"
        subtitle={
          employee
            ? `${employee.name} · ${employee.department}`
            : "Назначенные курсы, результаты и сертификаты"
        }
        action={
          <Link className="btn btn-outline" to="/courses">
            <BookOpen size={17} /> Каталог курсов
          </Link>
        }
      />
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="panel stat-card">
          <div className="stat-icon">
            <BookOpen size={22} />
          </div>
          <span className="muted">Назначено курсов</span>
          <strong>{assignments.length}</strong>
        </div>
        <div className="panel stat-card">
          <div className="stat-icon">
            <Clock3 size={22} />
          </div>
          <span className="muted">В обучении</span>
          <strong>{assignments.length - completeCount}</strong>
        </div>
        <div className="panel stat-card">
          <div className="stat-icon">
            <CheckCircle2 size={22} />
          </div>
          <span className="muted">Завершено</span>
          <strong>{completeCount}</strong>
        </div>
        <div className="panel stat-card">
          <div className="stat-icon">
            <CalendarDays size={22} />
          </div>
          <span className="muted">Срок истёк</span>
          <strong className={overdueCount ? "text-danger" : ""}>
            {overdueCount}
          </strong>
        </div>
      </div>
      <div className="section-heading">
        <div className="tabs">
          <button
            className={tab === "active" ? "active" : ""}
            onClick={() => setTab("active")}
          >
            В обучении <span>{assignments.length - completeCount}</span>
          </button>
          <button
            className={tab === "completed" ? "active" : ""}
            onClick={() => setTab("completed")}
          >
            Завершённые <span>{completeCount}</span>
          </button>
          <button
            className={tab === "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            Все курсы
          </button>
        </div>
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Поиск назначенного курса"
            placeholder="Найти курс"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      {!rows.length ? (
        <EmptyState
          title={
            tab === "completed"
              ? "Завершённых курсов пока нет"
              : "Курсы не найдены"
          }
          description={
            tab === "completed"
              ? "Здесь появятся результаты обучения и сертификаты."
              : "Выберите курс в каталоге или дождитесь назначения кадровой службой."
          }
        />
      ) : (
        <div className="cards course-grid">
          {rows.map(
            ({ assignment, course, progress, certificate }) =>
              course && (
                <article className="panel course-card" key={assignment.id}>
                  <div
                    className="course-cover"
                    style={{
                      background: course.coverColor || "#edf3fc",
                      minHeight: 100,
                      padding: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <GraduationCap size={36} strokeWidth={1.5} />
                    <LearningBadge progress={progress} />
                  </div>
                  <div style={{ padding: 22 }}>
                    <div className="section-heading">
                      <span className="muted small">{course.category}</span>
                      {assignment.required && (
                        <Badge tone="gray">Обязательный</Badge>
                      )}
                    </div>
                    <h3>
                      <Link to={`/courses/${course.id}`}>{course.title}</Link>
                    </h3>
                    <p className="muted small">
                      {course.durationHours} ч. · {course.chapters.length} глав
                    </p>
                    <Progress value={progress.progress} />
                    <p className="muted small">
                      Изучено: {progress.completedLessons} из{" "}
                      {progress.totalLessons} материалов
                      {progress.bestScore !== null
                        ? ` · Тест: ${progress.bestScore}%`
                        : ""}
                    </p>
                    <div className="section-heading" style={{ marginTop: 20 }}>
                      <span
                        className={progress.isOverdue ? "text-danger" : "muted"}
                      >
                        <CalendarDays
                          size={15}
                          style={{ verticalAlign: "middle" }}
                        />{" "}
                        {progress.isComplete
                          ? `Завершён ${dateLabel(assignment.completedAt)}`
                          : `До ${dateLabel(assignment.deadline)}`}
                      </span>
                      <Link
                        className="btn btn-primary"
                        to={`/courses/${course.id}`}
                      >
                        {progress.isComplete
                          ? "Результаты"
                          : progress.progress
                            ? "Продолжить"
                            : "Начать"}
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                    {certificate && (
                      <Button
                        variant="ghost"
                        style={{ marginTop: 12 }}
                        onClick={() => {
                          try {
                            printCertificate(
                              certificate,
                              state.settings.organizationName,
                            );
                          } catch (error) {
                            setError(errorText(error));
                          }
                        }}
                      >
                        <Award size={17} /> Скачать сертификат
                      </Button>
                    )}
                  </div>
                </article>
              ),
          )}
        </div>
      )}
    </>
  );
}
