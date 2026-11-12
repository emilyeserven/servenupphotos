import { type UseMutationResult, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, SaveIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { suggestedNameOf } from "@/api/errors";
import type { SanitizedExif } from "@/api/exif";
import type { PhotoGroups } from "@/api/organize";
import { type PhotoData, type PublishResult, publishPhotoMutation } from "@/api/photos";
import { type SettingsResponse, dataFolder, githubIsSetUp, settingsQuery } from "@/api/settings";
import { FloatingFlyout } from "@/components/floating-flyout";
import { PublishSuccess } from "@/components/github-save";
import { RenameForm } from "@/components/rename-prompt";
import { Spinner } from "@/components/ui/spinner";
import { jsonFileName, jsonNameProblem } from "@/lib/file-name";
import { photoData } from "@/lib/photo-data";

type Publish = UseMutationResult<PublishResult, Error, PhotoData>;

interface PhotoSaveButtonProps {
  file: string;
  sanitized: SanitizedExif;
  groups: PhotoGroups;
  /** The photo is in R2, so the JSON links to it. */
  uploaded: boolean;
  /** Called once the JSON file is saved. */
  onSaved: () => void;
}

type GitHub = SettingsResponse["github"];

/** What the button shows. */
interface Look {
  icon: ReactNode;
  label: string;
  variant: "default" | "outline";
}

function lookOf(publish: Publish): Look {
  if (publish.isPending) return { icon: <Spinner />, label: "Saving…", variant: "default" };
  if (publish.isSuccess) return { icon: <CheckIcon />, label: "Saved", variant: "outline" };
  if (publish.isError) return { icon: <TriangleAlertIcon />, label: "Save", variant: "default" };
  return { icon: <SaveIcon />, label: "Save", variant: "default" };
}

/** The GitHub settings, once the repository and token are set. */
function setUpGitHub(settings: SettingsResponse | undefined): GitHub | null {
  return settings && githubIsSetUp(settings) ? settings.github : null;
}

/** Whether clicking the button saves: GitHub is set up, and it isn't saving or saved. */
function canSave(github: GitHub | null, publish: Publish): boolean {
  return github !== null && (publish.isIdle || publish.isError);
}

/** Saving the photo's JSON, named after its title. */
function usePublish({ file, sanitized, groups, onSaved }: Omit<PhotoSaveButtonProps, "uploaded">) {
  const publish = useMutation({ ...publishPhotoMutation, onSuccess: onSaved });
  const named = jsonFileName(sanitized.title, file);
  /** Saves under name, or the one after the title when left out. */
  const save = (name = named) => publish.mutate(photoData(name, file, sanitized, groups));
  // After a rename, the flyout shows the name last tried.
  return { publish, name: publish.variables?.name ?? named, save };
}

/**
 * Floated next to the sync button: saves the new photo's JSON, named after its title (or its file
 * name without one), to the open photo data pull request, or opens a new one, with a flyout saying
 * where it goes and what happened.
 */
export function PhotoSaveButton({ uploaded, ...photo }: PhotoSaveButtonProps) {
  const settings = useQuery(settingsQuery);
  const github = setUpGitHub(settings.data);
  const { publish, name, save } = usePublish(photo);
  return (
    <FloatingFlyout
      {...lookOf(publish)}
      title="Save"
      onRun={canSave(github, publish) ? () => save() : undefined}
      disabled={publish.isPending}
    >
      <p className="font-medium">Save to the batch</p>
      <SaveDetails
        github={github}
        name={name}
        uploaded={uploaded}
        publish={publish}
        onRename={save}
      />
    </FloatingFlyout>
  );
}

interface SaveDetailsProps {
  github: GitHub | null;
  name: string;
  uploaded: boolean;
  publish: Publish;
  /** Saves under a new name, when the one asked for is taken. */
  onRename: (name: string) => void;
}

function SaveDetails({ github, publish, onRename, ...rest }: SaveDetailsProps) {
  if (!github) return <GitHubNotSetUp />;
  if (publish.isSuccess) return <PublishSuccess result={publish.data} />;
  return (
    <>
      <SaveIntro github={github} error={publish.error} {...rest} />
      <TakenNamePrompt error={publish.error} pending={publish.isPending} onRename={onRename} />
    </>
  );
}

/** When the name is taken, offers a free one, which can be changed, to save under instead. */
function TakenNamePrompt({
  error,
  pending,
  onRename,
}: {
  error: Error | null;
  pending: boolean;
  onRename: (name: string) => void;
}) {
  const suggested = suggestedNameOf(error);
  if (!suggested) return null;
  return (
    <RenameForm
      key={suggested}
      id="photo-save-name"
      suggested={suggested}
      extension=".json"
      submitLabel="Rename and save"
      validate={jsonNameProblem}
      onRename={onRename}
      disabled={pending}
    />
  );
}

interface SaveIntroProps {
  github: GitHub;
  name: string;
  uploaded: boolean;
  error: Error | null;
}

/** Where saving puts the JSON, and why the last try failed. */
function SaveIntro({ github, name, uploaded, error }: SaveIntroProps) {
  return (
    <>
      <p className="text-muted-foreground">
        Adds <code className="text-foreground">{jsonPath(github.folder, name)}</code> to the open
        “Add photo data” pull request in {github.repo}, or opens one against{" "}
        {github.branch.trim() || "the default branch"}. It's named after the title, or the photo's
        file name without one.
      </p>
      <NotUploadedNote uploaded={uploaded} />
      {error && <p className="text-destructive">{error.message}</p>}
    </>
  );
}

function jsonPath(folder: string, name: string): string {
  return `${dataFolder(folder)}/photos/${name}.json`;
}

/** Saving before uploading leaves the JSON's image links empty. */
function NotUploadedNote({ uploaded }: { uploaded: boolean }) {
  if (uploaded) return null;
  return (
    <p className="text-amber-700 dark:text-amber-400">
      The photo isn't in R2 yet, so the JSON's image links would be empty. Upload it first.
    </p>
  );
}

function GitHubNotSetUp() {
  return (
    <p className="text-muted-foreground">
      Set the GitHub repository and token in{" "}
      <Link to="/settings" className="text-foreground underline underline-offset-4">
        Settings
      </Link>{" "}
      first.
    </p>
  );
}
