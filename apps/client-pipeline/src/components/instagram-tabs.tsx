import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ScheduleTabsProps {
  /** The Calendar tab: the calendar of the coming weeks and its Instagram posts. */
  calendar: ReactNode;
  /** The Social Feed tab: the preview of the Instagram grid on a chosen day. */
  feed: ReactNode;
}

/**
 * The Instagram page's two tabs, Calendar and Social Feed. The open tab is kept in the address
 * (`?tab=feed`), so a reload or a link opens the same one.
 */
export function ScheduleTabs({ calendar, feed }: ScheduleTabsProps) {
  const { tab } = useSearch({ from: "/instagram" });
  const navigate = useNavigate({ from: "/instagram" });
  return (
    <Tabs
      value={tab ?? "calendar"}
      onValueChange={(next) =>
        void navigate({ search: next === "feed" ? { tab: "feed" } : {}, replace: true })
      }
    >
      <TabsList>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="feed">Social Feed</TabsTrigger>
      </TabsList>
      <TabsContent value="calendar" className="flex flex-col gap-4">
        {calendar}
      </TabsContent>
      <TabsContent value="feed">{feed}</TabsContent>
    </Tabs>
  );
}
