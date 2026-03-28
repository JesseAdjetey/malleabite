import { useRef, useEffect } from 'react';
import dayjs from 'dayjs';

/**
 * Returns the last navigation direction as a numeric multiplier:
 *  1  = moving forward (next week/day)
 * -1  = moving backward (prev week/day)
 *
 * Compares the current date string to the previously seen value.
 * Works for any granularity — just pass the date key that changes on navigation.
 */
export function useNavigationDirection(dateKey: string): React.MutableRefObject<number> {
  const directionRef = useRef<number>(1);
  const prevKeyRef = useRef<string>(dateKey);

  // Run synchronously during render (not in useEffect) so direction is ready
  // before any children read it in the same render cycle.
  if (prevKeyRef.current !== dateKey) {
    const prev = dayjs(prevKeyRef.current);
    const curr = dayjs(dateKey);
    directionRef.current = curr.isAfter(prev) ? 1 : -1;
    prevKeyRef.current = dateKey;
  }

  return directionRef;
}
