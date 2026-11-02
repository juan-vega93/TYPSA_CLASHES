import { useCallback, useEffect, useState, type SetStateAction } from "react";
export function useStoredState<T>(key: string, fallback: T, valid: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(fallback),
    [ready, setReady] = useState(false),
    [writable, setWritable] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      const text = localStorage.getItem(key),
        parsed: unknown = text ? JSON.parse(text) : fallback;
      if (!valid(parsed)) throw Error();
      setValue(parsed);
      setWritable(true);
    } catch {
      setError("No se pudo recuperar el guardado local. Conserva un respaldo JSON.");
    }
    setReady(true);
    // The initial fallback and validator are fixed for this storage key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready || !writable) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setError("");
    } catch {
      setError("No se pudo guardar en el navegador. Descarga un respaldo JSON antes de cerrar.");
    }
  }, [key, value, ready, writable]);
  const update = useCallback((next: SetStateAction<T>) => {
    setWritable(true);
    setValue(next);
  }, []);
  return { value, update, ready, error };
}
