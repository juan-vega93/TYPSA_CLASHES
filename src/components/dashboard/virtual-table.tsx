import { useMemo, useState } from "react";

export function useVirtualRows<T>({
  rows,
  rowHeight,
  overscan = 8,
}: {
  rows: T[];
  rowHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const virtual = useMemo(() => {
    const viewportHeight = 560;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(rows.length, start + visibleCount);
    return {
      rows: rows.slice(start, end).map((row, index) => ({
        row,
        index: start + index,
      })),
      before: start * rowHeight,
      after: Math.max(0, (rows.length - end) * rowHeight),
      totalHeight: rows.length * rowHeight,
    };
  }, [overscan, rowHeight, rows, scrollTop]);

  return { virtual, setScrollTop };
}
