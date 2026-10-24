import PDFDocument from "pdfkit";
import type { InvoiceView } from "./billing.service.js";
import type { BankDetails } from "./config.js";

const MONTH_NAMES = [
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

function money(value: number): string {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function buildInvoicePdf(
  invoice: InvoiceView,
  bank: BankDetails,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("EDUCAR PARA TRANSFORMAR", { align: "center" });
    doc.fontSize(9).text("Sistema de gestión · Módulo de cuotas", { align: "center" });
    doc.moveDown(1.5);
    doc.fontSize(14).text(`Factura ${String(invoice.id).padStart(6, "0")}`, { align: "right" });
    doc
      .fontSize(10)
      .text(
        `Período: ${MONTH_NAMES[invoice.periodMonth - 1]} ${invoice.periodYear} · Vence: ${invoice.dueDate}`,
        { align: "right" },
      );
    doc.moveDown(1);
    doc.fontSize(11).text(`Alumno: ${invoice.studentName}`);
    doc.text(`Estado: ${invoice.displayStatus}`);
    doc.moveDown(1);

    const startX = 50;
    let y = doc.y;
    doc.fontSize(10).text("Concepto", startX, y);
    doc.text("Importe", 400, y, { width: 80, align: "right" });
    doc.text("Pagado", 480, y, { width: 60, align: "right" });
    y += 18;
    doc.moveTo(startX, y).lineTo(545, y).strokeColor("#cccccc").stroke();
    y += 8;

    for (const item of invoice.items) {
      doc.fontSize(10).text(item.description, startX, y, { width: 330 });
      doc.text(money(item.amount), 400, y, { width: 80, align: "right" });
      doc.text(money(item.paidAmount), 480, y, { width: 60, align: "right" });
      y += 18;
    }

    y += 6;
    doc.moveTo(startX, y).lineTo(545, y).strokeColor("#cccccc").stroke();
    y += 10;
    doc.fontSize(11).text(`Total: $${money(invoice.totalAmount)}`, startX, y);
    doc.text(`Saldo: $${money(invoice.balance)}`, 400, y, { width: 145, align: "right" });
    y += 40;

    doc.fontSize(9).fillColor("#555555");
    doc.text("Datos para transferencia:", startX, y);
    y += 14;
    doc.text(`Alias: ${bank.alias}`, startX, y);
    y += 12;
    doc.text(`CBU: ${bank.cbu}`, startX, y);
    y += 12;
    doc.text(`Titular: ${bank.holder}`, startX, y);
    y += 22;
    doc.text("No se aceptan pagos en efectivo. El comprobante queda pendiente hasta la validación administrativa.", startX, y, {
      width: 495,
    });

    doc.end();
  });
}
