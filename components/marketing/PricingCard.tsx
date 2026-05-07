import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PricingCardProps {
  planName: string;
  price: string;
  period: string;
  subtitle: string;
  badge?: string;
  badgeVariant?: "secondary" | "outline";
  strikeThroughPrice?: string;
  features: string[];
  cta: React.ReactNode;
  finePrint?: string;
  highlighted?: boolean;
  large?: boolean;
}

export function PricingCard({
  planName,
  price,
  period,
  subtitle,
  badge,
  badgeVariant = "secondary",
  strikeThroughPrice,
  features,
  cta,
  finePrint,
  highlighted = false,
  large = false,
}: PricingCardProps) {
  return (
    <Card className={cn("flex flex-col", highlighted && "border-foreground/30")}>

      {/* ① Plan name + optional badge */}
      <CardHeader className="pb-2 space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">{planName}</p>
          {badge && (
            <Badge
              variant={badgeVariant}
              className="rounded-full px-2 py-0.5 text-xs"
            >
              {badge}
            </Badge>
          )}
        </div>

        {/* ② Price */}
        <div className="space-y-1">
          <div className="flex items-end gap-1">
            <span className={cn("font-semibold", large ? "text-5xl" : "text-4xl")}>
              {price}
            </span>
            <span className="text-muted-foreground mb-1">{period}</span>
          </div>
          {strikeThroughPrice && (
            <p className="text-xs text-muted-foreground">
              Regular price:{" "}
              <span className="line-through">{strikeThroughPrice}</span>
            </p>
          )}
          {/* ③ Subtitle */}
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardHeader>

      {/* ④ Features */}
      <CardContent className="flex-1 pt-2">
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <span className="shrink-0 mt-0.5 text-foreground">✓</span>
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      {/* ⑤ CTA */}
      <CardFooter className="flex flex-col gap-2 pt-4">
        {cta}
        {finePrint && (
          <p className="text-xs text-center text-muted-foreground">{finePrint}</p>
        )}
      </CardFooter>

    </Card>
  );
}
