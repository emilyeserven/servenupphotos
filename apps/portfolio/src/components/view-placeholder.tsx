import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortfolioView, type PortfolioView } from "@/lib/portfolio-views";

export function ViewPlaceholder({ to }: { to: PortfolioView["to"] }) {
  const { label, description, icon: Icon } = getPortfolioView(to);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-3">
          <Icon className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <CardTitle className="text-3xl tracking-tight">{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
