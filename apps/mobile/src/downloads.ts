import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiUrl } from "./api";

async function downloadAndShare(path: string, token: string, fileName: string): Promise<void> {
  if (Platform.OS === "web") {
    throw new Error("La descarga de archivos está disponible en la app móvil.");
  }
  const directory = FileSystem.cacheDirectory;
  if (!directory) {
    throw new Error("No hay almacenamiento disponible en el dispositivo.");
  }
  const target = `${directory}${fileName}`;
  const result = await FileSystem.downloadAsync(apiUrl(path), target, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("El dispositivo no permite compartir archivos.");
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Comprobante",
  });
}

export async function sharePaymentReceipt(
  paymentId: number,
  token: string,
  number: string | null,
  scope: "parent" | "admin" = "parent",
): Promise<void> {
  const path =
    scope === "admin"
      ? `/admin/billing/payments/${paymentId}/receipt`
      : `/parent/billing/payments/${paymentId}/receipt`;
  await downloadAndShare(path, token, `comprobante-pago-${number ?? paymentId}.pdf`);
}

export async function shareInvoicePdf(
  invoiceId: number,
  token: string,
  scope: "parent" | "admin" = "parent",
): Promise<void> {
  const path =
    scope === "admin"
      ? `/admin/billing/invoices/${invoiceId}/pdf`
      : `/parent/billing/invoices/${invoiceId}/pdf`;
  await downloadAndShare(path, token, `factura-${invoiceId}.pdf`);
}

export async function shareUploadedReceipt(
  receiptId: number,
  token: string,
  fileName: string,
): Promise<void> {
  await downloadAndShare(
    `/billing/receipts/${receiptId}/file`,
    token,
    fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || `comprobante-${receiptId}`,
  );
}
