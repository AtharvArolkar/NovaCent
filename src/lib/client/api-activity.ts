"use client";

import { useEffect, useSyncExternalStore, useState } from "react";

const defaultMessage = "Working on your request...";

type ApiActivitySnapshot = {
  count: number;
  message: string;
};

const listeners = new Set<() => void>();
const activeRequests = new Map<number, string>();
let requestId = 0;
let currentSnapshot: ApiActivitySnapshot = { count: 0, message: defaultMessage };

function nextSnapshot(): ApiActivitySnapshot {
  const messages = Array.from(activeRequests.values()).filter(Boolean);
  return {
    count: activeRequests.size,
    message: messages.at(-1) ?? defaultMessage
  };
}

function emit() {
  currentSnapshot = nextSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentSnapshot;
}

export function beginApiActivity(message = defaultMessage) {
  const id = ++requestId;
  activeRequests.set(id, message);
  emit();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeRequests.delete(id);
    emit();
  };
}

export async function withApiActivity<T>(task: () => Promise<T>, options: { message?: string; track?: boolean } = {}) {
  if (options.track === false) {
    return task();
  }

  const end = beginApiActivity(options.message);
  try {
    return await task();
  } finally {
    end();
  }
}

export function useApiActivity(delayMs = 250) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (snapshot.count <= 0) {
      setVisible(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, snapshot.count]);

  return {
    ...snapshot,
    visible: visible && snapshot.count > 0
  };
}
