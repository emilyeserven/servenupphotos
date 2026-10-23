import { useMutation } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { type MetaGroup, saveMetaGroupMutation } from "@/api/metainfo";
import { Button } from "@/components/ui/button";
import { childrenOf, movedGroups } from "@/lib/meta-groups";

interface MetaMoveButtonsProps {
  group: MetaGroup;
  /** The field's groups. */
  groups: MetaGroup[];
}

/**
 * Moves a group one place up or down among the groups in the same parent, saving the new order of
 * each group whose place changes, each as a change waiting for Commit.
 */
export function MetaMoveButtons({ group, groups }: MetaMoveButtonsProps) {
  const save = useMutation(saveMetaGroupMutation);
  const siblings = childrenOf(groups, group.parent ?? "");
  const at = siblings.findIndex((g) => g.id === group.id);
  const move = (by: -1 | 1) => {
    for (const moved of movedGroups(siblings, group.id, by)) save.mutate(moved);
  };
  return (
    <span className="flex shrink-0 gap-0.5">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Move ${group.name} up`}
        disabled={at <= 0}
        onClick={() => move(-1)}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Move ${group.name} down`}
        disabled={at === -1 || at === siblings.length - 1}
        onClick={() => move(1)}
      >
        <ArrowDownIcon aria-hidden />
      </Button>
    </span>
  );
}
