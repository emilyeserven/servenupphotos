import { useEffect, useRef, useState } from "react";
/** An element's size in CSS pixels. */
interface Size {
  width: number;
  height: number;
}

const UNMEASURED: Size = { width: 0, height: 0 };

/** A ref for an element and its size in pixels, kept up to date as it resizes; 0 by 0 until it's measured. */
export function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(UNMEASURED);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      setSize(box ? { width: box.width, height: box.height } : UNMEASURED);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
