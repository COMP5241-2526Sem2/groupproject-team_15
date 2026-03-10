export function buildScaffoldedFeedback(thinkingProcess: string, attempts: number) {
  const conciseThought = thinkingProcess.slice(0, 180);

  if (attempts <= 1) {
    return {
      promptType: "socratic",
      prompt: `You started with: "${conciseThought}". What assumption did you make in your first step, and how can you verify it with evidence?`,
      hintTier: 1,
      partialCredit: 0.2,
    };
  }

  if (attempts <= 3) {
    return {
      promptType: "tiered_hint",
      prompt:
        "Try isolating one variable, then recalculate each step. Which step changes the final result the most?",
      hintTier: 2,
      partialCredit: 0.5,
    };
  }

  return {
    promptType: "partial_solution",
    prompt:
      "Partial path: write knowns, derive the governing equation, substitute values, then check unit consistency before finalizing.",
    hintTier: 3,
    partialCredit: 0.7,
  };
}
