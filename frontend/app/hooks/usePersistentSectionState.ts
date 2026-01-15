"use client";

import { useCallback, useEffect, useState } from "react";

export function usePersistentSectionState(
  key: string,
  defaultValue: boolean = true,
): [boolean, (value: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) {
        setValue(defaultValue);
      } else {
        setValue(stored === "true");
      }
    } catch {
      setValue(defaultValue);
    }
  }, [key, defaultValue]);

  const update = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: boolean) => boolean)(prev) : next;
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, resolved ? "true" : "false");
          } catch {
            // ignore storage errors
          }
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}
