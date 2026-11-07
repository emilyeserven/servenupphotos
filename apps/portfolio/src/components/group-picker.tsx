import { FolderOpen } from "lucide-react";
import { useState } from "react";
import {
  type GroupPickerProps,
  type GroupSection,
  GroupPickerPart,
  useSections,
} from "@portfolio/components/group-picker-parts";
import { FilterPickerButton, SectionPicker } from "@portfolio/components/section-picker";
import { GROUP_KEYS, withoutFilters } from "@portfolio/lib/photo-filters";

/**
 * A **Groups** button that opens one picker for the album, tag and genre filters, like **When**: a
 * list of Albums, Tags and Genres on the left, each saying what it's set to, and the chosen one's
 * choices on the right. One of each can be chosen at once. Tags and Genres are left out while there
 * are none. On phones the list folds up above the choices, under a button naming the chosen one.
 */
export function GroupPicker(props: GroupPickerProps) {
  const sections = useSections(props);
  const count = sections.filter((section) => section.chosen).length;
  return (
    <FilterPickerButton
      Icon={FolderOpen}
      label="Groups"
      count={count}
      onClear={() => props.setFilters(withoutFilters(props.filters, GROUP_KEYS))}
    >
      <PickerBody sections={sections} {...props} />
    </FilterPickerButton>
  );
}

/** The first section with a choice made, or the albums when none has one. */
function firstChosen(sections: GroupSection[]): GroupSection["key"] {
  return sections.find((section) => section.chosen)?.key ?? "album";
}

/** The sections, each with its icon and what's chosen in it, and the chosen section's choices. */
function PickerBody({ sections, ...props }: GroupPickerProps & { sections: GroupSection[] }) {
  const [key, setKey] = useState(() => firstChosen(sections));
  const section = sections.find((each) => each.key === key) ?? sections[0];
  if (!section) return null;
  return (
    <SectionPicker
      label="Group filters"
      sections={sections.map((each) => ({
        key: each.key,
        label: each.label,
        Icon: each.Icon,
        set: Boolean(each.chosen),
        text: each.chosenText ?? "Any",
      }))}
      chosen={section.key}
      onChoose={setKey}
      width="sm:w-[30rem]"
    >
      <GroupPickerPart key={section.key} section={section} {...props} />
    </SectionPicker>
  );
}
