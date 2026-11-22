import React from "react";
import { Check } from "lucide-react";
import type { CheckInAnalysisDTO } from "@/lib/body-comp/dto";

type Analysis = Omit<CheckInAnalysisDTO, "generatedAt" | "modelUsed"> & { modelUsed?: string };

/** An AI body-composition estimate: body fat, notes, comparison, highlights and advice. */
export function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-2.5">
      {(analysis.estimatedBodyFatPercent !== null || analysis.estimatedBodyFatRange) && (
        <p className="flex flex-wrap items-baseline gap-x-2">
          {analysis.estimatedBodyFatPercent !== null && (
            <span className="font-mono text-[17px] font-semibold tabular-nums text-ink">~{analysis.estimatedBodyFatPercent}% body fat</span>
          )}
          {analysis.estimatedBodyFatRange && <span className="text-xs text-ink-3">Range {analysis.estimatedBodyFatRange}</span>}
        </p>
      )}
      {analysis.qualitativeNotes && <p className="text-[13px] leading-5 text-ink-2">{analysis.qualitativeNotes}</p>}
      {analysis.comparedToPrevious && (
        <p className="text-[13px] leading-5 text-ink-2">
          <span className="font-medium text-ink">Compared with last time: </span>
          {analysis.comparedToPrevious}
        </p>
      )}
      {analysis.muscleGroupHighlights.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Standout muscle groups">
          {analysis.muscleGroupHighlights.map((item, index) => (
            <li key={index} className="rounded-chip border border-line bg-elevated px-2 py-0.5 text-xs text-ink-2">
              {item}
            </li>
          ))}
        </ul>
      )}
      {analysis.recommendations.length > 0 && (
        <ul className="space-y-1 border-t border-line pt-2 text-[13px] text-ink-2" aria-label="Recommendations">
          {analysis.recommendations.map((recommendation, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="leading-5">{recommendation}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-3">An AI estimate, not a measurement{analysis.modelUsed ? ` · ${analysis.modelUsed}` : ""}.</p>
    </div>
  );
}

export default AnalysisView;
