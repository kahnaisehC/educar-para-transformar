import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "./api";
import type { Child } from "./types";

export function useChildren(token: string | null) {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ children: Child[] }>("/parent/children", { token });
      setChildren(result.children);
      setSelectedId((current) => current ?? result.children[0]?.id ?? null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [token]);

  return { children, selectedId, setSelectedId, loading, error, reload };
}
