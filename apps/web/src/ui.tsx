import { ApiError } from "./api";
import type { UserRole } from "./types";
export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Alumno",
  parent: "Padre / madre",
  teacher: "Docente",
  admin: "Administrador",
  director: "Dirección",
};


export const ROLE_HOME: Record<UserRole, string> = {
  student: "/alumno",
  parent: "/padre",
  teacher: "/docente",
  admin: "/admin/usuarios",
  director: "/direccion",
};


export const SIDEBAR_ITEMS: Record<UserRole, Array<{ label: string; to: string }>> = {
  student: [{ label: "Resumen", to: "/alumno" }],
  parent: [{ label: "Resumen", to: "/padre" }],
  teacher: [
    { label: "Resumen", to: "/docente" },
    { label: "Mis cursos", to: "/docente/cursos" },
  ],
  admin: [
    { label: "Usuarios", to: "/admin/usuarios" },
    { label: "Académico", to: "/admin/academico" },
    { label: "Deportes y servicios", to: "/admin/servicios" },
    { label: "Inscripciones", to: "/admin/inscripciones" },
    { label: "Reportes", to: "/admin/reportes" },
  ],
  director: [{ label: "Resumen", to: "/direccion" }],
};

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

export function PanelHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="panel-heading"><div><span className="overline">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div></div>;
}

export function InlineMessage({ tone, children }: { tone: "success" | "error"; children: string }) {
  return <div className={`inline-message ${tone}`} role="status"><span>{tone === "success" ? "✓" : "!"}</span>{children}</div>;
}

export function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "empty-state-compact" : ""}`}><span className="empty-mark">—</span><strong>{title}</strong><p>{detail}</p></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="error-state"><span className="error-mark">!</span><h2>No pudimos cargar esta vista</h2><p>{message}</p><button className="secondary-button" onClick={onRetry}>Intentar de nuevo</button></div>;
}

export function DashboardSkeleton() {
  return <div className="skeleton-layout" aria-label="Cargando"><div className="skeleton skeleton-wide" /><div className="skeleton-grid"><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /></div></div>;
}

export function FullPageState({ label }: { label: string }) {
  return <main className="full-page-state"><span className="loading-dot" /><span>{label}...</span></main>;
}

export function getPageTitle(role: UserRole) {
  if (role === "student") return "Mi actividad escolar";
  if (role === "parent") return "Seguimiento familiar";
  if (role === "admin") return "Administración";
  return ROLE_LABELS[role];
}

export function getSportInitial(sport: string) {
  return sport.trim().slice(0, 1).toUpperCase();
}

export function formatDate(value: string | null) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("es-AR");
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("es-AR");
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado. Intentá nuevamente.";
}

export function downloadCsv(filename: string, header: string[], lines: string[][]) {
  const escape = (value: string) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [header, ...lines].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${rows}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);}
