import type { Group, GroupKind, OrganizeResponse } from "@/api/organize";

/** The album, tag or genre a page shows, with every album, tag and genre it was read with. */
export interface GroupDetailProps {
  /** Whether it's an album, a tag or a genre. */
  kind: GroupKind;
  /** The album, tag or genre itself. */
  group: Group;
  /** Every album, tag and genre, and the open photo data pull request. */
  organize: OrganizeResponse;
}
