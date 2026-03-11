type PromptType = "socratic" | "tiered_hint" | "partial_solution";

type ScaffoldedFeedback = {
  promptType: PromptType;
  prompt: string;
  hintTier: number;
  partialCredit: number;
};

function buildDeterministicScaffold(
  thinkingProcess: string,
  attempts: number,
): ScaffoldedFeedback {
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

export async function buildScaffoldedFeedback(
  thinkingProcess: string,
  attempts: number,
): Promise<ScaffoldedFeedback> {
  const fallback = buildDeterministicScaffold(thinkingProcess, attempts);

  const githubToken = process.env.GITHUB_TOKEN;
  const endpoint =
    process.env.GITHUB_MODEL_ENDPOINT || "https://models.inference.ai.azure.com";
  const modelName = process.env.GITHUB_MODEL_NAME || "gpt-4o-mini";

  if (!githubToken) {
    return fallback;
  }

  try {
    const response = await fetch(`${endpoint.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are an educational coach. Return exactly one short scaffolded prompt to help a student progress without giving the full answer.",
          },
          {
            role: "user",
            content: `Attempt number: ${attempts}\nPrompt type: ${fallback.promptType}\nHint tier: ${fallback.hintTier}\nStudent thinking process:\n${thinkingProcess.slice(0, 1800)}\n\nWrite one concise scaffolded feedback prompt (max 70 words).`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const generatedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (!generatedPrompt) {
      return fallback;
    }

    return {
      ...fallback,
      prompt: generatedPrompt,
    };
  } catch {
    return fallback;
  }
}
