import { Navigate, NavLink, Route, Routes } from "react-router-dom";

import { NotificationBell } from "./components/NotificationBell";

import { AdminDashboard } from "./pages/AdminDashboard";

import { DirectorDashboard } from "./pages/DirectorDashboard";

import { ParentDashboard } from "./pages/ParentDashboard";

import { StudentDashboard } from "./pages/StudentDashboard";

import { TeacherDashboard } from "./pages/TeacherDashboard";

import type { User } from "./types";

import { ROLE_HOME, ROLE_LABELS, SIDEBAR_ITEMS, getPageTitle } from "./ui";

export function AppShell({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/assets/logo-educar-para-transformar.png" alt="" className="sidebar-logo" />
          <div>
            <strong>EDUCAR</strong>
            <span>para transformar</span>
          </div>
        </div>
        <div className="sidebar-rule" />
        <div className="sidebar-context">
          <span className="context-dot" />
          <span>Portal {ROLE_LABELS[user.role]}</span>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          <span className="nav-label">Espacio de trabajo</span>
          {SIDEBAR_ITEMS[user.role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
            >
              <span className="nav-symbol">⌂</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <img src="/assets/logo-tecnicatura-univ-en-prog.png" alt="Tecnicatura Universitaria en Programación" className="career-logo" />
          <p>Una comunidad que aprende, participa y crece.</p>
        </div>
      </aside>
      <div className="content-frame">
        <header className="topbar">
          <div className="mobile-brand">
            <img src="/assets/logo-educar-para-transformar.png" alt="" />
            <strong>EDUCAR</strong>
          </div>
          <div className="topbar-spacer" />
          <NotificationBell token={token} />
          <div className="user-menu">
            <div className="user-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{user.displayName}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </div>
            <button className="logout-button" onClick={onLogout} title="Cerrar sesión">
              Salir
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-intro">
            <div>
              <p className="overline">{ROLE_LABELS[user.role]}</p>
              <h1>{getPageTitle(user.role)}</h1>
            </div>
            <span className="sprint-mark">SISTEMA DE GESTIÓN <i /> ACTIVO</span>
          </div>
          <Routes>
            <Route path="/" element={<Navigate to={ROLE_HOME[user.role]} replace />} />
            {user.role === "student" && (
              <Route path="/alumno" element={<StudentDashboard token={token} />} />
            )}
            {user.role === "parent" && (
              <Route path="/padre" element={<ParentDashboard token={token} />} />
            )}
            {user.role === "teacher" && (
              <>
                <Route path="/docente" element={<TeacherDashboard token={token} view="overview" />} />
                <Route path="/docente/cursos" element={<TeacherDashboard token={token} view="courses" />} />
              </>
            )}
            {user.role === "admin" && (
              <Route path="/admin/:section" element={<AdminDashboard token={token} currentUser={user} />} />
            )}
            {user.role === "director" && (
              <Route path="/direccion" element={<DirectorDashboard token={token} />} />
            )}
            <Route path="*" element={<Navigate to={ROLE_HOME[user.role]} replace />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>EDUCAR PARA TRANSFORMAR</span>
          <span>Información protegida</span>
        </footer>
      </div>
    </div>
  );
}
