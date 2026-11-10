import PDFDocument from "pdfkit";
import type { PaymentDetail } from "./billing.service.js";

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

function money(value: number): string {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function buildPaymentReceiptPdf(detail: PaymentDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("EDUCAR PARA TRANSFORMAR", { align: "center" });
    doc.fontSize(9).text("Comprobante de pago definitivo", { align: "center" });
    doc.moveDown(1.5);
    doc.fontSize(14).text(`Comprobante ${detail.payment.number ?? detail.payment.id}`, {
      align: "right",
    });
    doc
      .fontSize(10)
      .text(`Fecha: ${new Date(detail.payment.createdAt).toLocaleString("es-AR")}`, {
        align: "right",
      });
    doc.moveDown(1);
    doc.fontSize(11).text(`Alumno: ${detail.invoice.studentName}`);
    doc.text(
      `Período: ${MONTHS[detail.invoice.periodMonth - 1]} ${detail.invoice.periodYear}`,
    );
    doc.text(`Factura: ${String(detail.invoice.id).padStart(6, "0")}`);
    doc.text(`Medio de pago: transferencia bancaria`);
    doc.moveDown(1);

    const startX = 50;
    let y = doc.y;
    doc.fontSize(10).text("Concepto imputado", startX, y);
    doc.text("Importe", 450, y, { width: 95, align: "right" });
    y += 18;
    doc.moveTo(startX, y).lineTo(545, y).strokeColor("#cccccc").stroke();
    y += 8;

    for (const allocation of detail.allocations) {
      doc.fontSize(10).text(allocation.description, startX, y, { width: 380 });
      doc.text(money(allocation.amount), 450, y, { width: 95, align: "right" });
      y += 18;
    }

    y += 6;
    doc.moveTo(startX, y).lineTo(545, y).strokeColor("#cccccc").stroke();
    y += 10;
    doc.fontSize(12).text(`Total acreditado: $${money(detail.payment.amount)}`, startX, y);
    y += 30;
    doc.fontSize(9).fillColor("#555555");
    doc.text(`Aprobado por: ${detail.approvedBy ?? "Administración"}`, startX, y);
    y += 14;
    doc.text(
      "Este comprobante acredita el pago de los ítems detallados. No se aceptan pagos en efectivo.",
      startX,
      y,
      { width: 495 },
    );

    doc.end();
  });
}
