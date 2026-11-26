/** "In flight", linked to the pull request, or "Merged". */
export function GroupStatus({
  inFlight,
  pullRequestUrl,
}: {
  inFlight: boolean;
  pullRequestUrl?: string;
}) {
  if (!inFlight) return <span className="text-muted-foreground">Merged</span>;
  return (
    <a
      href={pullRequestUrl}
      target="_blank"
      rel="noreferrer"
      className="text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
    >
      In flight
    </a>
  );
}
