const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function money(value: number): string {
  return `$${Number(value ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function monthLabel(month: number): string {
  return MONTHS[month - 1] ?? "";
}

export function periodLabel(year: number, month: number): string {
  return `${monthLabel(month)} ${year}`;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("es-AR");
}

export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString("es-AR");
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    partial: "Pago parcial",
    paid: "Pagada",
    cancelled: "Cancelada",
    overdue: "Vencida",
    approved: "Aprobado",
    rejected: "Rechazado",
    monthly: "Cuota",
    sport: "Deporte",
    transport: "Transporte",
    cafeteria: "Comedor",
  };
  return labels[status] ?? status;
}
