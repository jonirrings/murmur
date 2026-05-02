import { useState, useEffect, useRef, useCallback } from "react";
import { AUTO_SAVE_DEBOUNCE_MS } from "@/shared/constants";

interface UseAutoSaveOptions<T> {
  data: T;
  saveFn: (arg0: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  save: () => Promise<void>;
}

export function useAutoSave<T>({
  data,
  saveFn,
  debounceMs = AUTO_SAVE_DEBOUNCE_MS,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const dataRef = useRef(data);
  const saveFnRef = useRef(saveFn);
  const savedSnapshot = useRef(JSON.stringify(data));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  dataRef.current = data;
  saveFnRef.current = saveFn;

  const save = useCallback(async () => {
    const currentData = dataRef.current;
    if (JSON.stringify(currentData) === savedSnapshot.current) return;

    setIsSaving(true);
    try {
      await saveFnRef.current(currentData);
      savedSnapshot.current = JSON.stringify(currentData);
      setLastSaved(new Date());
      setIsDirty(false);
    } catch (err) {
      console.error("Auto-save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const snapshot = JSON.stringify(data);
    const dirty = snapshot !== savedSnapshot.current;
    setIsDirty(dirty);

    if (!dirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, debounceMs) as unknown as ReturnType<typeof setTimeout>;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, debounceMs, save]);

  useEffect(() => {
    return () => {
      const currentData = dataRef.current;
      if (JSON.stringify(currentData) !== savedSnapshot.current) {
        saveFnRef.current(currentData).catch(() => {});
      }
    };
  }, []);

  return { isSaving, lastSaved, isDirty, save };
}
