import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Holds a blob: URL for a file. Setting a new file revokes the previous URL, and the
 * last one is revoked on unmount.
 */
export function useObjectUrl(): [string | null, (file: Blob | null) => void] {
  const [url, setUrl] = useState<string | null>(null);
  const current = useRef<string | null>(null);

  const setFile = useCallback((file: Blob | null) => {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = file ? URL.createObjectURL(file) : null;
    setUrl(current.current);
  }, []);

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  return [url, setFile];
}
