import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clock3,
  LayoutGrid,
  List,
  Plus,
  Search,
  Users,
  ArrowRight,
} from "lucide-react";
import { Badge, Button, EmptyState, PageHeading } from "../../../components/ui";
import { useHr } from "../../../store/HrContext";
import { entityLabels } from "./CourseShared";

export default function CoursesPage() {
  const { state, role } = useHr();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const courses = state.courses.filter(
    (course) =>
      (role === "hr" || course.status === "published") &&
      (status === "all" || course.status === status) &&
      (category === "all" || course.category === category) &&
      `${course.title} ${course.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const categories = [
    ...new Set(state.courses.map((course) => course.category)),
  ];
  return (
    <>
      <PageHeading
        title="Каталог курсов"
        subtitle="Обучение и развитие профессиональных компетенций"
        action={
          role === "hr" ? (
            <Link className="btn btn-primary" to="/courses/new">
              <Plus size={18} /> Создать курс
            </Link>
          ) : undefined
        }
      />
      <div className="panel toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Поиск курса"
            placeholder="Название или описание курса"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Направление курса"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">Все направления</option>
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        {role === "hr" && (
          <select
            aria-label="Статус курса"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Все статусы</option>
            <option value="published">Опубликованные</option>
            <option value="draft">Черновики</option>
            <option value="archived">В архиве</option>
          </select>
        )}
        <div className="actions">
          <Button
            variant={view === "cards" ? "primary" : "outline"}
            aria-label="Карточки"
            title="Карточки"
            onClick={() => setView("cards")}
          >
            <LayoutGrid size={18} />
          </Button>
          <Button
            variant={view === "table" ? "primary" : "outline"}
            aria-label="Таблица"
            title="Таблица"
            onClick={() => setView("table")}
          >
            <List size={18} />
          </Button>
        </div>
      </div>
      <div className="list-meta">
        <span className="muted">Найдено курсов: {courses.length}</span>
      </div>
      {!courses.length ? (
        <EmptyState
          title="Курсы не найдены"
          description="Измените условия поиска или создайте новый курс."
        />
      ) : view === "cards" ? (
        <div className="cards course-grid">
          {courses.map((course) => (
            <article className="panel course-card" key={course.id}>
              <div
                className="course-cover"
                style={{
                  background: course.coverColor || "#edf3fc",
                  minHeight: 108,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 24,
                }}
              >
                <BookOpen size={36} strokeWidth={1.6} />
                <Badge tone={course.status === "published" ? "green" : "gray"}>
                  {entityLabels[course.status]}
                </Badge>
              </div>
              <div className="course-body" style={{ padding: 22 }}>
                <div className="eyebrow muted">{course.category}</div>
                <h3>
                  <Link to={`/courses/${course.id}`}>{course.title}</Link>
                </h3>
                <p className="muted" style={{ minHeight: 44 }}>
                  {course.description.length > 150
                    ? course.description.slice(0, 150) + "…"
                    : course.description}
                </p>
                <div className="course-meta">
                  <span>
                    <Clock3 size={15} /> {course.durationHours} ч.
                  </span>
                  <span>
                    <BookOpen size={15} />{" "}
                    {course.chapters.reduce(
                      (sum, chapter) => sum + chapter.lessons.length,
                      0,
                    )}{" "}
                    материалов
                  </span>
                  <span>
                    <Users size={15} />{" "}
                    {
                      state.assignments.filter(
                        (assignment) =>
                          assignment.courseId === course.id &&
                          !assignment.cancelledAt,
                      ).length
                    }
                  </span>
                </div>
                <div
                  className="actions"
                  style={{ justifyContent: "space-between", marginTop: 20 }}
                >
                  <Link
                    className="btn btn-outline"
                    to={`/courses/${course.id}`}
                  >
                    Открыть курс <ArrowRight size={16} />
                  </Link>
                  {role === "hr" && (
                    <Link
                      className="text-link"
                      to={`/courses/${course.id}/edit`}
                    >
                      Изменить
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Курс</th>
                <th>Направление</th>
                <th>Объём</th>
                <th>Материалы</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>
                    <Link className="text-link" to={`/courses/${course.id}`}>
                      {course.title}
                    </Link>
                  </td>
                  <td>{course.category}</td>
                  <td>{course.durationHours} ч.</td>
                  <td>
                    {course.chapters.reduce(
                      (sum, chapter) => sum + chapter.lessons.length,
                      0,
                    )}
                  </td>
                  <td>
                    <Badge
                      tone={course.status === "published" ? "green" : "gray"}
                    >
                      {entityLabels[course.status]}
                    </Badge>
                  </td>
                  <td>
                    {role === "hr" ? (
                      <Link
                        to={`/courses/${course.id}/edit`}
                        className="text-link"
                      >
                        Изменить
                      </Link>
                    ) : (
                      <Link to={`/courses/${course.id}`} className="text-link">
                        Открыть
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
