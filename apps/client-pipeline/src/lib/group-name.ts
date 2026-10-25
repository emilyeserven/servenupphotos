import {
  type Group,
  type OrganizeResponse,
  GROUP_KINDS,
  findCollision,
  groupId,
} from "@/api/organize";

/** Per field, what to say when the album or tag `group`, of kind `what`, already has the value. */
const COLLISIONS = {
  id: (what: string, group: Group) =>
    `The ${what} “${group.name || group.id}” already has the ID “${group.id}”, made from this name.`,
  name: (what: string, group: Group) => `There's already a ${what} named “${group.name}”.`,
};

/** Why `value` can't be used for `field`, when an album or tag already has it. */
function collisionMessage(
  organize: OrganizeResponse | undefined,
  field: "id" | "name",
  value: string,
): string | undefined {
  const found = organize ? findCollision(organize, field, value) : undefined;
  return found && COLLISIONS[field](GROUP_KINDS[found.kind].singular, found.group);
}

/** Why `name` itself can't be used, before checking it against the albums and tags. */
function nameProblem(name: string): string | undefined {
  if (!name.trim()) return "Give it a name.";
  if (name.trim().length > 100) return "Keep the name to 100 characters.";
  if (!groupId(name)) return "Include a letter or number from a to z or 0 to 9, so it gets an ID.";
  return undefined;
}

/** Why `name` can't be used, including when an album or tag has it or the ID made from it. */
export function validateGroupName(
  organize: OrganizeResponse | undefined,
  name: string,
): string | undefined {
  return (
    nameProblem(name) ??
    collisionMessage(organize, "name", name) ??
    collisionMessage(organize, "id", groupId(name))
  );
}
