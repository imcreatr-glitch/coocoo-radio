"use client";

import { useEffect, useState } from "react";

/** Re-rendering clock — returns current Date, refreshed every `intervalMs` (default 30s). */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
