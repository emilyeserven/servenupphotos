import { useQuery } from "@tanstack/react-query";
import { TriangleAlertIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { type CSSProperties, useEffect, useState } from "react";
import {
  type JpegComparison,
  type VersionName,
  VERSIONS,
  versionPreviewQuery,
} from "@/api/versions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useObjectUrl } from "@/hooks/use-object-url";

/** What the lightbox shows: one of the resized versions, or the original JPEG. */
type Shown = VersionName | "original";

/** Buttons that open each resized WEBP version of photo, or the original, at full size in a lightbox. */
export function VersionPreviews({ photo }: { photo: File }) {
  const [shown, setShown] = useState<Shown | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resized versions</CardTitle>
        <CardDescription>
          Uploading also puts these WEBP versions in R2. Open one to check its quality at its true
          size.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {VERSIONS.map((version) => (
          <Button key={version.name} variant="outline" onClick={() => setShown(version.name)}>
            {version.label} ({version.maxEdge}px)
          </Button>
        ))}
        <Button variant="outline" onClick={() => setShown("original")}>
          Original
        </Button>
      </CardContent>
      <Lightbox photo={photo} shown={shown} onClose={() => setShown(null)} />
    </Card>
  );
}

interface LightboxProps {
  photo: File;
  shown: Shown | null;
  onClose: () => void;
}

/** A full-window overlay showing the chosen image, at its true size when the window fits it. */
function Lightbox({ photo, shown, onClose }: LightboxProps) {
  const title = titleOf(shown);
  return (
    <Dialog.Root open={shown !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col text-white outline-none">
          <div className="flex items-start gap-4 p-4">
            <div className="flex flex-1 flex-col gap-1">
              <Dialog.Title className="font-medium">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">
                The {title.toLowerCase()} of {photo.name} at full size.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <XIcon />
              </Button>
            </Dialog.Close>
          </div>
          {shown && <LightboxBody photo={photo} shown={shown} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function titleOf(shown: Shown | null): string {
  if (shown === "original") return "Original JPEG";
  return `${VERSIONS.find((v) => v.name === shown)?.label ?? ""} version`;
}

function LightboxBody({ photo, shown }: { photo: File; shown: Shown }) {
  if (shown === "original") return <LightboxImage blob={photo} format="JPEG" />;
  return <VersionImage photo={photo} version={shown} />;
}

function VersionImage({ photo, version }: { photo: File; version: VersionName }) {
  const query = useQuery(versionPreviewQuery(photo, version));
  if (query.isPending) {
    return (
      <p className="flex items-center gap-2 px-4 text-sm text-white/70">
        <Spinner /> Making the {version} version…
      </p>
    );
  }
  if (query.isError) return <p className="px-4 text-sm text-red-400">{query.error.message}</p>;
  return (
    <LightboxImage
      blob={query.data.webp}
      format="WEBP"
      jpeg={query.data.jpeg}
      blur={version === "preview" ? PREVIEW_BLUR : undefined}
    />
  );
}

/**
 * The CSS filter the preview is shown with, stretched to fill the window, the way a page would
 * show it while the real image loads: it smooths the preview's few big pixels into soft color.
 */
const PREVIEW_BLUR = "blur(12px)";

const sizeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

interface Fit {
  natural: { width: number; height: number };
  /** The size the image is drawn at, in screen pixels (CSS pixels times the device pixel ratio). */
  shown: { width: number; height: number };
  /** Screen pixels per CSS pixel: 2 on most Retina screens. */
  pixelRatio: number;
}

/**
 * The image pixel for pixel on the screen, centered, with its dimensions and file size. On a
 * Retina screen that is half its CSS size, since the browser would otherwise stretch each image
 * pixel over 2 × 2 screen pixels and blur it. When the window is too small for that, it is scaled
 * down to fit and a warning says so.
 */
function LightboxImage({ blob, format, jpeg, blur }: LightboxImageProps) {
  const [url, setBlob] = useObjectUrl();
  useEffect(() => setBlob(blob), [blob, setBlob]);
  const [setImage, fit] = useImageFit();

  return (
    <>
      <ImageFacts blob={blob} format={format} jpeg={jpeg} blur={blur} fit={fit} />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 pt-0">
        {url && (
          <img
            ref={setImage}
            src={url}
            alt=""
            style={imageStyle(fit, blur)}
            className="h-auto max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </>
  );
}

/** Pixel for pixel, or stretched to fill the space and blurred when there's a blur. */
function imageStyle(fit: Fit | null, blur?: string): CSSProperties | undefined {
  if (blur) return { width: "100%", height: "100%", filter: blur };
  return fit ? { width: fit.natural.width / fit.pixelRatio } : undefined;
}

/** The image's size in pixels and bytes, what WEBP saves, and whether it had to be scaled down. */
function ImageFacts({ blob, format, jpeg, blur, fit }: LightboxImageProps & { fit: Fit | null }) {
  return (
    <div className="flex flex-col gap-1 px-4 pb-3 text-sm">
      <p className="text-white/70">
        {fit && `${fit.natural.width} × ${fit.natural.height}px · `}
        {sizeFormat.format(blob.size / 1024)} KB {format}
        {retinaNote(fit, blur)}
      </p>
      {jpeg && <WebpSavings webpBytes={blob.size} jpeg={jpeg} fit={fit} />}
      <FitNote fit={fit} blur={blur} />
    </div>
  );
}

/** How the image is drawn, when that needs saying: blurred, or scaled down to fit the window. */
function FitNote({ fit, blur }: { fit: Fit | null; blur?: string }) {
  if (blur) return <BlurNote blur={blur} />;
  return fit && <ScaledWarning fit={fit} />;
}

/** Says the image is stretched and blurred, with the CSS that does it. */
function BlurNote({ blur }: { blur: string }) {
  return (
    <p className="text-white/70">
      Stretched to fill the window and smoothed with{" "}
      <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-white">filter: {blur};</code>{" "}
      as a page would show it while the real image loads.
    </p>
  );
}

/** Explains why the image looks small on a high-density screen, where it's drawn pixel for pixel. */
function retinaNote(fit: Fit | null, blur?: string): string {
  if (blur || !fit || fit.pixelRatio <= 1) return "";
  return ` · shown pixel for pixel on this ${fit.pixelRatio}× screen`;
}

interface LightboxImageProps {
  blob: Blob;
  format: string;
  /** For a WEBP version, its size as a JPEG instead, to show what WEBP saves. */
  jpeg?: JpegComparison;
  /** A CSS filter, such as "blur(12px)": the image is then stretched to fill the space. */
  blur?: string;
}

const percentFormat = new Intl.NumberFormat(undefined, { style: "percent" });

interface WebpSavingsProps {
  webpBytes: number;
  jpeg: JpegComparison;
  fit: Fit | null;
}

/** How much smaller the WEBP is than a JPEG of the same pixel size, at the original's quality. */
function WebpSavings({ webpBytes, jpeg, fit }: WebpSavingsProps) {
  const dimensions = fit ? `${fit.natural.width} × ${fit.natural.height}px ` : "";
  const saved = 1 - webpBytes / jpeg.bytes;
  return (
    <p className={saved > 0 ? "text-emerald-300" : "text-amber-300"}>
      {saved > 0
        ? `${percentFormat.format(saved)} smaller than`
        : `${percentFormat.format(-saved)} bigger than`}{" "}
      {`a ${dimensions}JPEG of the same image at the original's quality, ${jpeg.quality} (${sizeFormat.format(jpeg.bytes / 1024)} KB).`}
    </p>
  );
}

/** Says the image is smaller than its true size, when the window made it so. */
function ScaledWarning({ fit }: { fit: Fit }) {
  if (fit.shown.width >= fit.natural.width) return null;
  return (
    <p role="status" className="flex items-start gap-2 text-amber-300">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Shown at {fit.shown.width} × {fit.shown.height} screen pixels, not its true{" "}
        {fit.natural.width} × {fit.natural.height}px, because the window is too small. Widen the
        window or zoom out to see every pixel.
      </span>
    </p>
  );
}

/** Measures an image's true size against the size it's drawn at, again whenever it resizes. */
function useImageFit() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [value, setValue] = useState<Fit | null>(null);

  useEffect(() => {
    if (!img) return;
    const measure = () => {
      if (!img.naturalWidth) return;
      const pixelRatio = window.devicePixelRatio || 1;
      setValue({
        natural: { width: img.naturalWidth, height: img.naturalHeight },
        shown: {
          width: Math.round(img.clientWidth * pixelRatio),
          height: Math.round(img.clientHeight * pixelRatio),
        },
        pixelRatio,
      });
    };
    measure();
    img.addEventListener("load", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => {
      img.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, [img]);

  return [setImg, value] as const;
}
