import { Link } from "@tanstack/react-router";
import type { SocialCalendar } from "@/api/publish";
import { PhotoImage } from "@/components/instagram-photo-picker";
import { PhotoFiles } from "@/components/photo-files";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSocialQueue } from "@/hooks/use-social-queue";
import { dayFormat, parseIsoDate } from "@/lib/calendar";
import { photoName } from "@/lib/social-schedule";
import type { SocialQueue } from "@/lib/social-queue";

/** How many of the next scheduled photos the card shows. */
const SHOWN = 3;

/** The next 3 photos scheduled for Instagram, and how many days the queue has left. */
export function InstagramCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link to="/instagram" className="hover:underline">
            Next on Instagram
          </Link>
        </CardTitle>
        <CardDescription>
          From the Instagram calendar, with changes not committed yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PhotoFiles>{(calendar) => <Queue calendar={calendar} />}</PhotoFiles>
      </CardContent>
    </Card>
  );
}

function Queue({ calendar }: { calendar: SocialCalendar }) {
  const queue = useSocialQueue(calendar, SHOWN);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <QueueNote queue={queue} />
      </p>
      {queue.next.length > 0 && (
        <ul className="grid grid-cols-3 gap-3">
          {queue.next.map(({ day, photo }) => (
            <li key={day} className="flex min-w-0 flex-col gap-1.5">
              <Link
                to="/exif"
                search={{ edit: photo.path }}
                className="group flex min-w-0 flex-col gap-1.5"
              >
                <span className="bg-muted aspect-square overflow-hidden rounded-md border">
                  <PhotoImage photo={photo} />
                </span>
                <span className="truncate text-sm font-medium group-hover:underline">
                  {photoName(photo)}
                </span>
              </Link>
              <span className="text-muted-foreground -mt-1 text-xs">
                {dayFormat.format(parseIsoDate(day))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** How many days are left in the queue from today, and any scheduled after a gap. */
function QueueNote({ queue }: { queue: SocialQueue }) {
  return (
    <>
      <DaysLeft queue={queue} />
      {queue.later > 0 && <LaterNote later={queue.later} />}
    </>
  );
}

/** The days in a row from today with a photo, through the last of them. */
function DaysLeft({ queue }: { queue: SocialQueue }) {
  if (!queue.lastDay) return <strong>Nothing is queued for today.</strong>;
  const days = queue.daysLeft === 1 ? "1 day" : `${queue.daysLeft} days`;
  return (
    <>
      <strong>{days} left</strong> in the queue, through{" "}
      {dayFormat.format(parseIsoDate(queue.lastDay))}.
    </>
  );
}

/** How many photos are scheduled after the first empty day. */
function LaterNote({ later }: { later: number }) {
  return (
    <span className="text-muted-foreground">
      {" "}
      {later === 1 ? "1 more is" : `${later} more are`} scheduled after a gap.
    </span>
  );
}
