import { createFileRoute } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: ComingSoon,
});

function ComingSoon() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-3">
          <Camera className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <CardTitle className="text-3xl tracking-tight">Coming soon</CardTitle>
          <CardDescription>
            A new photography portfolio is in the works. Check back shortly.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
