"use client";

import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Skill } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface SkillBadgeProps {
  skill: Skill;
}

const MATCH_STYLES = {
  exact: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400",
  partial: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
  missing: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
};

const MATCH_ICONS = {
  exact: CheckCircle2,
  partial: MinusCircle,
  missing: XCircle,
};

export function SkillBadge({ skill }: SkillBadgeProps) {
  const Icon = MATCH_ICONS[skill.match_strength];
  const tooltipText = {
    exact: `Found in resume (${skill.category})`,
    partial: `Partially matched in resume (${skill.category})`,
    missing: `Not found in resume (${skill.category})`,
  }[skill.match_strength];

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-default",
          MATCH_STYLES[skill.match_strength]
        )}
      >
        <Icon className="w-3 h-3 shrink-0" />
        {skill.name}
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
