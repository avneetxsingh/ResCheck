"use client";

import { useState } from "react";
import { SkillBadge } from "./SkillBadge";
import { ScoreRing } from "./ScoreRing";
import { CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SkillsGapAnalysis } from "@/types/analysis";

interface SkillsGapPanelProps {
  skillsGap: SkillsGapAnalysis;
}

type FilterType = "all" | "present" | "missing";

export function SkillsGapPanel({ skillsGap }: SkillsGapPanelProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredMustHave = skillsGap.must_have.filter((s) => {
    if (filter === "present") return s.present_in_resume;
    if (filter === "missing") return !s.present_in_resume;
    return true;
  });

  const filteredNiceToHave = skillsGap.nice_to_have.filter((s) => {
    if (filter === "present") return s.present_in_resume;
    if (filter === "missing") return !s.present_in_resume;
    return true;
  });

  const missingCount = [
    ...skillsGap.must_have,
    ...skillsGap.nice_to_have,
  ].filter((s) => !s.present_in_resume).length;

  return (
    <div className="space-y-6">
      {/* Match score */}
      <div className="flex items-center gap-6 p-6 rounded-xl border border-border/50">
        <ScoreRing
          score={skillsGap.overall_match_percentage}
          size="md"
          label="Skill Match"
        />
        <div>
          <p className="font-medium">Skill match</p>
          <p className="text-sm text-muted-foreground mt-1">
            {missingCount > 0
              ? `${missingCount} ${missingCount === 1 ? "skill" : "skills"} from the posting ${missingCount === 1 ? "doesn't" : "don't"} appear in your resume.`
              : "Every skill the posting asks for shows up in your resume."}
          </p>
          {skillsGap.bonus_skills.length > 0 && (
            <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
              <Star className="w-3 h-3" />
              plus {skillsGap.bonus_skills.length} the posting didn&apos;t ask for
            </p>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "present", "missing"] as FilterType[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Must Have */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Must have
            <span className="text-xs text-muted-foreground font-normal tabular-nums">
              {skillsGap.must_have.length}
            </span>
          </h3>
          {filteredMustHave.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filteredMustHave.map((skill) => (
                <SkillBadge key={skill.name} skill={skill} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No skills match this filter.</p>
          )}
        </div>

        {/* Nice To Have */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Nice to have
            <span className="text-xs text-muted-foreground font-normal tabular-nums">
              {skillsGap.nice_to_have.length}
            </span>
          </h3>
          {filteredNiceToHave.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filteredNiceToHave.map((skill) => (
                <SkillBadge key={skill.name} skill={skill} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No skills match this filter.</p>
          )}
        </div>
      </div>

      {/* Bonus skills */}
      {skillsGap.bonus_skills.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-primary" />
            Beyond the posting
            <span className="text-xs text-muted-foreground font-normal">
              on your resume, not in the JD
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {skillsGap.bonus_skills.map((skill, i) => {
              let name: string;
              if (typeof skill === "string") {
                name = skill;
              } else if (skill && typeof skill === "object") {
                const obj = skill as Record<string, unknown>;
                name = typeof obj.name === "string" ? obj.name : JSON.stringify(obj);
              } else {
                name = String(skill);
              }
              if (!name.trim()) return null;
              return (
                <span
                  key={`${name}-${i}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium"
                >
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Perfect match state */}
      {missingCount === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/30">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Nothing missing — every skill in the posting is covered.
          </p>
        </div>
      )}
    </div>
  );
}
