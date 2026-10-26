import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

interface WebStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getWebStorage(): WebStorage | null {
  const candidate = (globalThis as { localStorage?: WebStorage }).localStorage;
  return candidate ?? null;
}

const isWeb = Platform.OS === "web";

export async function getStoredItem(key: string): Promise<string | null> {
  if (isWeb) {
    return getWebStorage()?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setStoredItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    getWebStorage()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteStoredItem(key: string): Promise<void> {
  if (isWeb) {
    getWebStorage()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
