import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Award,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Files,
  GraduationCap,
  Home,
  LayoutDashboard,
  Library,
  Settings,
  Users,
} from "lucide-react";
import saqMark from "../assets/saq-mark.svg";

export type HrRole = "hr" | "employee";
export interface SaqSidebarProps {
  role: HrRole;
  notificationsCount?: number;
}

const navigation = [
  { to: "/dashboard", label: "Обзор обучения", icon: LayoutDashboard },
  { to: "/courses", label: "Курсы", icon: BookOpen },
  { to: "/programs", label: "Программы обучения", icon: Files },
  { to: "/employees", label: "Сотрудники", icon: Users },
  { to: "/assignments", label: "Назначения", icon: CalendarCheck },
  { to: "/tests", label: "Тесты и вопросы", icon: ClipboardCheck },
  { to: "/results", label: "Результаты и отчёты", icon: Award },
  { to: "/library", label: "Библиотека", icon: Library },
];
const employeeNavigation = [
  { to: "/my-learning", label: "Моё обучение", icon: BookOpenCheck },
  { to: "/courses", label: "Каталог курсов", icon: BookOpen },
  { to: "/library", label: "Библиотека", icon: Library },
];

export default function SaqSidebar({ role }: SaqSidebarProps) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem("saq.sidebar.expanded.v1") !== "false";
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setExpanded((current) => {
      try {
        localStorage.setItem("saq.sidebar.expanded.v1", String(!current));
      } catch {
        /* The menu remains usable without storage. */
      }
      return !current;
    });
  const items = role === "hr" ? navigation : employeeNavigation;

  return (
    <aside className={`saq-sidebar ${expanded ? "expanded" : "collapsed"}`}>
      <div className="saq-brand-row">
        <a
          className="saq-brand"
          href="https://smartaudit.kz/"
          aria-label="SAQ — главная страница"
        >
          <img src={saqMark} alt="" />
          <span>
            <strong>SAQ</strong>
            <small>Система государственного аудита</small>
          </span>
        </a>
        <button
          type="button"
          className="saq-sidebar-toggle"
          onClick={toggle}
          aria-label={expanded ? "Свернуть меню" : "Развернуть меню"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <nav className="saq-navigation" aria-label="Разделы модуля Кадры">
        <p className="saq-navigation-caption">Модули системы</p>
        <section className="saq-module-group">
          <div className="saq-module-title">
            <span className="saq-module-mark">
              <GraduationCap size={20} />
            </span>
            <span>Кадры</span>
            <span className="module-expand" aria-hidden="true">
              ⌃
            </span>
          </div>
          <div className="saq-module-menu">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => (isActive ? "active" : "")}
                aria-label={label}
                title={!expanded ? label : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </section>
      </nav>
      <div className="sidebar-bottom">
        <a
          className="sidebar-setting"
          href="https://smartaudit.kz/"
          aria-label="Главная SAQ"
          title={!expanded ? "Главная SAQ" : undefined}
        >
          <Home size={18} aria-hidden="true" />
          <span>Главная SAQ</span>
        </a>
        {role === "hr" && (
          <NavLink
            className="sidebar-setting"
            to="/settings"
            aria-label="Настройки"
            title={!expanded ? "Настройки" : undefined}
          >
            <Settings size={18} aria-hidden="true" />
            <span>Настройки</span>
          </NavLink>
        )}
        <p className="sidebar-version">
          <span className="status-dot" />
          Учебный модуль SAQ
        </p>
      </div>
    </aside>
  );
}
