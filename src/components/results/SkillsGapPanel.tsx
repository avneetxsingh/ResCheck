"use client";

import { useId, useState } from "react";
import { SkillBadge } from "./SkillBadge";
import { ScoreRing } from "./ScoreRing";
import { CheckCircle2, ChevronDown, ChevronUp, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResumeSection, Skill, SkillsGapAnalysis } from "@/types/analysis";

interface SkillsGapPanelProps {
  skillsGap: SkillsGapAnalysis;
}

type FilterType = "all" | "present" | "missing";

// Only the three evidence tiers earn a pill. "missing" and old history entries
// are already conveyed by SkillBadge's own colour and icon, so rendering them
// here put two identical badges side by side.
const STRENGTH_PILL: Record<"strong" | "moderate" | "weak", { text: string; tone: string }> = {
  strong: { text: "Strong", tone: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" },
  moderate: { text: "Moderate", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  // "weak" means claimed in a skills list with no dated role behind it —
  // "Listed" says that plainly instead of implying a judgement.
  weak: { text: "Listed", tone: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/30" },
};

function strengthPill(skill: Skill): { text: string; tone: string } | null {
  const s = skill.strength;
  return s === "strong" || s === "moderate" || s === "weak" ? STRENGTH_PILL[s] : null;
}

// months under 24 renders in months, at/above renders in whole years —
// mind the singular/plural agreement on both.
function formatRecency(months: number | null | undefined): string | null {
  if (typeof months !== "number") return null;
  if (months <= 0) return "currently using";
  if (months < 24) return `used ${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.round(months / 12);
  return `used ${years} ${years === 1 ? "year" : "years"} ago`;
}

// null means the role's dates did not parse — distinct from a role that
// genuinely lasted zero months, so render nothing rather than "0 mo".
function formatRoleDuration(months: number | null): string | null {
  return months === null ? null : `${months} mo`;
}

function formatEndedAt(endedAt: string | null): string {
  return endedAt ? `to ${endedAt}` : "to present";
}

function formatSectionList(sections: ResumeSection[]): string {
  if (sections.length <= 1) return `your ${sections[0] ?? "resume"} section`;
  const last = sections[sections.length - 1];
  const rest = sections.slice(0, -1).join(", ");
  return `your ${rest} and ${last} sections`;
}

function hasExpandableEvidence(skill: Skill): boolean {
  const evidence = skill.evidence;
  if (!evidence) return false;
  return evidence.roles.length > 0 || evidence.sections.length > 0;
}

// One row per skill, shared by the must-have and nice-to-have lists. Legacy
// history entries carry neither `strength` nor `evidence`, so every branch
// below degrades to plain SkillBadge-only rendering for them — no crash, no
// empty disclosure triangle.
function SkillRow({ skill }: { skill: Skill }) {
  const [expanded, setExpanded] = useState(false);
  const evidenceId = useId();
  const pill = strengthPill(skill);
  const recency = formatRecency(skill.last_used_months_ago);
  // Weak skills have no dated role, so there's never a recency to show —
  // say so instead of leaving the row silently blank.
  const summary = recency ?? (skill.strength === "weak" ? "no dated role" : null);
  const expandable = hasExpandableEvidence(skill);

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn("flex items-center gap-1.5 flex-wrap", expandable && "cursor-pointer")}
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? expanded : undefined}
        aria-controls={expandable ? evidenceId : undefined}
        onClick={expandable ? () => setExpanded((e) => !e) : undefined}
        onKeyDown={
          expandable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded((v) => !v);
                }
              }
            : undefined
        }
      >
        {/* SkillBadge's tooltip trigger renders a real, independently focusable
            <button> (base-ui useFocus opens the tooltip on keyboard focus), so
            without this it double-fires the row's click/Enter/Space toggle. */}
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <SkillBadge skill={skill} />
        </span>
        {pill && (
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium",
              pill.tone
            )}
          >
            {pill.text}
          </span>
        )}
        {summary && <span className="text-xs text-muted-foreground">{summary}</span>}
        {expandable &&
          (expanded ? (
            <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden />
          ))}
      </div>
      {expandable && expanded && skill.evidence && (
        <div id={evidenceId} className="pl-4 space-y-0.5">
          {skill.evidence.roles.length > 0 ? (
            skill.evidence.roles.map((r, i) => {
              const duration = formatRoleDuration(r.months);
              const segments = [r.title, duration, formatEndedAt(r.ended_at)].filter(
                (s): s is string => s !== null
              );
              return (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span aria-hidden className="shrink-0">└</span>
                  <span>{segments.join(" · ")}</span>
                </p>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <span aria-hidden className="shrink-0">└</span>
              <span>appears only in {formatSectionList(skill.evidence.sections)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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

  // Zero missing is vacuously true when nothing was extracted from the
  // posting, so every success string below has to check this first.
  const anyRequirements =
    skillsGap.must_have.length + skillsGap.nice_to_have.length > 0;

  const missingCount = [
    ...skillsGap.must_have,
    ...skillsGap.nice_to_have,
  ].filter((s) => !s.present_in_resume).length;

  return (
    <div className="space-y-6">
      {/* Match score */}
      <div className="flex items-center gap-6 p-6 rounded-xl border border-border/50">
        {typeof skillsGap.overall_match_percentage === "number" && (
          <ScoreRing score={skillsGap.overall_match_percentage} size="md" label="Skill Match" />
        )}
        <div>
          <p className="font-medium">Skill match</p>
          <p className="text-sm text-muted-foreground mt-1">
            {!anyRequirements
              ? "No requirements could be read from this posting, so there was nothing to match against."
              : missingCount > 0
                ? `${missingCount} ${missingCount === 1 ? "skill" : "skills"} from the posting ${missingCount === 1 ? "doesn't" : "don't"} appear in your resume.`
                : "Every skill the posting asks for shows up in your resume."}
          </p>
          {skillsGap.bonus_skills.length > 0 && (
            <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
              <Star className="w-3 h-3" />
              plus {skillsGap.bonus_skills.length}{" "}
              {skillsGap.bonus_skills.length === 1 ? "skill" : "skills"} the posting didn&apos;t ask for
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
                <SkillRow key={skill.name} skill={skill} />
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
                <SkillRow key={skill.name} skill={skill} />
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

      {/* Perfect match state — vacuously true with no requirements, where it
          contradicted the route's own "no usable requirements" warning in the
          same view, so it needs something to actually have been checked. */}
      {anyRequirements && missingCount === 0 && (
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
