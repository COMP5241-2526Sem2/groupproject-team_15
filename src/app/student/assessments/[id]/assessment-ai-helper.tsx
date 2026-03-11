"use client";

import { useActionState } from "react";
import { askAssessmentHintByAi, type AssessmentHintState } from "@/app/actions";

type Props = {
  assessmentId: string;
};

const initialState: AssessmentHintState = {
  question: "",
  hint: "",
};

export default function AssessmentAiHelper({ assessmentId }: Props) {
  const [state, askHintAction, isLoading] = useActionState(askAssessmentHintByAi, initialState);

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-[var(--stroke)] p-4">
      <h3 className="text-lg font-semibold">Ask AI Helper</h3>
      <p className="text-sm opacity-80">Ask about this assessment and get hints (no direct answer).</p>

      <form action={askHintAction} className="space-y-3">
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <textarea
          name="question"
          className="field min-h-24"
          placeholder="Ask a question about this assessment"
          required
          defaultValue={state.question}
        />
        <button className="btn-secondary" type="submit" disabled={isLoading}>
          {isLoading ? "Thinking..." : "Ask AI"}
        </button>
      </form>

      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
      {state.hint ? (
        <div className="space-y-2 rounded-lg border border-[var(--stroke)] p-3">
          <p className="text-sm font-semibold">Hint</p>
          <p className="whitespace-pre-wrap text-sm">{state.hint}</p>
        </div>
      ) : null}
    </div>
  );
}
