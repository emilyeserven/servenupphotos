import { Link } from "@tanstack/react-router";
import type { SocialCalendar } from "@/api/publish";
import { PhotoFiles } from "@/components/photo-files";
import { SpotlightFocus } from "@/components/spotlight-focus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The Photo page's card for the photo at path's focus point, used when a spotlight zone, such as
 * the homepage's, shows it. Like other spotlight changes, it's kept in the app until **Commit**,
 * apart from the page's own Save changes.
 */
export function SpotlightCard({ path }: { path: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spotlight</CardTitle>
        <CardDescription>
          The spots on the portfolio show the albums picked on{" "}
          <Link to="/site-spotlight" className="underline underline-offset-4">
            Site Spotlight
          </Link>
          . When one shows this photo, the focus point keeps its best part in view. Changes are kept
          in the app until you <strong>Commit</strong>, without Save changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PhotoFiles>{(files) => <Focus files={files} path={path} />}</PhotoFiles>
      </CardContent>
    </Card>
  );
}

function Focus({ files, path }: { files: SocialCalendar; path: string }) {
  const photo = files.photos.find((p) => p.path === path);
  if (!photo) {
    return (
      <p className="text-muted-foreground text-sm">
        This photo&apos;s file wasn&apos;t among the photo files read. Save it first.
      </p>
    );
  }
  return <SpotlightFocus photo={photo} />;
}
