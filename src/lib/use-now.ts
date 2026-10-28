"use client";

import { useEffect, useState } from "react";
import { nowIST } from "@/lib/types";

/** Re-rendering PUNJAB (IST) clock — returns current India-time Date, refreshed
 *  every `intervalMs` (default 30s). Visitor kisi vi desh ch hove, same Punjab time. */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => nowIST());
  useEffect(() => {
    const id = setInterval(() => setNow(nowIST()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
