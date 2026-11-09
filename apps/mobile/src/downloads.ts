import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiUrl } from "./api";

export async function sharePaymentReceipt(
  paymentId: number,
  token: string,
  number: string | null,
  scope: "parent" | "admin" = "parent",
): Promise<void> {
  if (Platform.OS === "web") {
    throw new Error("La descarga del comprobante está disponible en la app móvil.");
  }
  const path =
    scope === "admin"
      ? `/admin/billing/payments/${paymentId}/receipt`
      : `/parent/billing/payments/${paymentId}/receipt`;
  const directory = FileSystem.cacheDirectory;
  if (!directory) {
    throw new Error("No hay almacenamiento disponible en el dispositivo.");
  }
  const target = `${directory}comprobante-${number ?? paymentId}.pdf`;
  const result = await FileSystem.downloadAsync(apiUrl(path), target, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("El dispositivo no permite compartir archivos.");
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Comprobante de pago",
  });
}
