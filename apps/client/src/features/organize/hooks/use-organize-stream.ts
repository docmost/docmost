import { useEffect, useRef, useState } from "react";
import {
  IOrganizeEvent,
  IOrganizeTaskDetail,
  OrganizeStreamMessage,
} from "@/features/organize/types/organize.types";

interface UseOrganizeStreamResult {
  task: IOrganizeTaskDetail | null;
  events: IOrganizeEvent[];
  connected: boolean;
  done: boolean;
}

/**
 * Subscribes to the server SSE relay for an organize task and keeps a live
 * task + ordered events view. Auth rides the same-origin auth cookie, so a
 * plain EventSource works. Closes when the task reaches a terminal state.
 */
export function useOrganizeStream(
  organizeTaskId: string | null | undefined,
): UseOrganizeStreamResult {
  const [task, setTask] = useState<IOrganizeTaskDetail | null>(null);
  const [events, setEvents] = useState<IOrganizeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!organizeTaskId) return;

    seen.current = new Set();
    setEvents([]);
    setDone(false);

    const source = new EventSource(
      `/api/organize-tasks/${organizeTaskId}/stream`,
      { withCredentials: true },
    );

    source.onopen = () => setConnected(true);

    source.onmessage = (e) => {
      let msg: OrganizeStreamMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "snapshot") {
        setTask(msg.task);
        const initial = msg.task.events ?? [];
        initial.forEach((ev) => seen.current.add(ev.id));
        setEvents(initial);
      } else if (msg.type === "event") {
        if (!seen.current.has(msg.event.id)) {
          seen.current.add(msg.event.id);
          setEvents((prev) => [...prev, msg.event]);
        }
        setTask((prev) =>
          prev
            ? {
                ...prev,
                completed: msg.completed,
                total: msg.total,
                status: msg.status,
              }
            : prev,
        );
      } else if (msg.type === "done") {
        setTask((prev) => (prev ? { ...prev, status: msg.status } : prev));
        setDone(true);
        source.close();
        setConnected(false);
      }
    };

    source.onerror = () => {
      // EventSource auto-reconnects; reflect the transient disconnect
      setConnected(false);
    };

    return () => {
      source.close();
    };
  }, [organizeTaskId]);

  return { task, events, connected, done };
}
