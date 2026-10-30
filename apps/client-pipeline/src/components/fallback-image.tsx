import { type ImgHTMLAttributes, type SyntheticEvent, useState } from "react";

type FallbackImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  /** Shown instead when src doesn't load, such as the offline copy's Small version while offline. */
  fallback?: string;
};

/** Whether src failed before and there's a fallback to show instead. */
function showsFallback(failed: string | undefined, src: string, fallback?: string): boolean {
  return failed === src && Boolean(fallback);
}

/**
 * An image that switches to `fallback` when `src` doesn't load; `onError` is only called when the
 * fallback fails too, or there's none.
 */
export function FallbackImage({ src, fallback, onError, ...props }: FallbackImageProps) {
  const [failed, setFailed] = useState<string>();
  const usingFallback = showsFallback(failed, src, fallback);
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (usingFallback || !fallback) onError?.(event);
    else setFailed(src);
  };
  return <img {...props} src={usingFallback ? fallback : src} onError={handleError} />;
}
