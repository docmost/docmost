import { useCallback, useRef } from 'react';

type LongPressOptions = {
  threshold?: number;
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
};

type LongPressHandlers = {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
};

export function useLongPress({
  threshold = 400,
  onLongPress,
  onClick,
}: LongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressRef.current = false;

      // Store initial position to detect movement
      if ('touches' in e) {
        startPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else {
        startPosRef.current = { x: e.clientX, y: e.clientY };
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress(e);
      }, threshold);
    },
    [onLongPress, threshold]
  );

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (shouldTriggerClick && !isLongPressRef.current && onClick) {
        onClick(e);
      }
    },
    [onClick]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left click
      if (e.button !== 0) return;
      start(e);
    },
    [start]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      clear(e);
    },
    [clear]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      clear(e, false);
    },
    [clear]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      start(e);
    },
    [start]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clear(e);
    },
    [clear]
  );

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}
