import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortfolioView } from "@/lib/portfolio-views";

export const Route = createFileRoute("/")({
  component: ComingSoon,
});

function ComingSoon() {
  const { to, label, icon: Icon } = getPortfolioView("/grid");

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-3">
          <Camera className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <CardTitle className="text-3xl tracking-tight">Coming soon</CardTitle>
          <CardDescription>
            A new photography portfolio is in the works. Check back shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to={to}>
              <Icon aria-hidden />
              Browse the {label.toLowerCase()}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
