"use client";

import { Sparkles, TrendingUp, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface TopicCardProps {
  name: string;
  description: string;
  hint: string;
  fromBrief: boolean;
  onDiscover: () => void;
}

function HintIcon({ fromBrief, hint }: { fromBrief: boolean; hint: string }) {
  if (fromBrief) return <BookOpen className="size-3" />;
  if (hint.toLowerCase().includes("trending")) return <TrendingUp className="size-3" />;
  return <Sparkles className="size-3" />;
}

export function TopicCard({ name, description, hint, fromBrief, onDiscover }: TopicCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">{name}</CardTitle>
          <Badge
            variant={fromBrief ? "default" : "secondary"}
            className="text-xs shrink-0 gap-1 whitespace-nowrap"
          >
            <HintIcon fromBrief={fromBrief} hint={hint} />
            {hint}
          </Badge>
        </div>
        <CardDescription className="text-xs leading-relaxed mt-1">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 mt-auto">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs"
          onClick={onDiscover}
        >
          Discover Sources
        </Button>
      </CardContent>
    </Card>
  );
}
