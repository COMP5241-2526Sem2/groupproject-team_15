import "server-only";

type MaterialSummaryInput = {
  title: string;
  description: string | null;
  fileUrl: string | null;
};

export type MaterialSummary = {
  summary: string;
  studyTips: string[];
  source: "ai" | "fallback";
  reason?: string;
};

function getFileExtension(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : "";
  } catch {
    return "";
  }
}

function isTextLike(contentType: string, extension: string) {
  if (contentType.startsWith("text/")) return true;
  if (["application/json", "application/xml"].some((value) => contentType.includes(value))) {
    return true;
  }

  return ["txt", "md", "csv", "json", "xml", "html", "htm"].includes(extension);
}

function buildUnavailableSummary(input: MaterialSummaryInput, reason?: string): MaterialSummary {
  return {
    summary: "AI not work",
    studyTips: [],
    source: "fallback",
    reason,
  };
}

function isLowValueAiSummary(text: string) {
  const normalized = text.toLowerCase();

  const blockedPhrases = [
    "does not contain any readable text",
    "no readable text",
    "no information to summarize",
    "unable to summarize",
    "cannot summarize",
    "not enough information",
  ];

  return blockedPhrases.some((phrase) => normalized.includes(phrase));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(retryAfterHeader: string | null, attempt: number) {
  const parsedSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
  if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
    return parsedSeconds * 1000;
  }

  const exponential = 1000 * 2 ** attempt;
  return Math.min(exponential, 8000);
}

async function requestAiText(params: {
  endpoint: string;
  githubToken: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const requestBody = JSON.stringify({
    model: params.modelName,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: params.systemPrompt,
      },
      {
        role: "user",
        content: params.userPrompt,
      },
    ],
  });

  const url = `${params.endpoint.replace(/\/+$/, "")}/chat/completions`;

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.githubToken}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (response.status !== 429) {
      break;
    }

    if (attempt < 2) {
      const delayMs = getRetryDelayMs(response.headers.get("retry-after"), attempt);
      await sleep(delayMs);
    }
  }

  if (!response) {
    return { content: null, reason: "AI request failed before receiving a response." };
  }

  if (!response.ok) {
    if (response.status === 429) {
      return {
        content: null,
        reason: "AI API is rate-limited right now (429). Please wait about a minute and try again.",
      };
    }

    return {
      content: null,
      reason: `AI API request failed (${response.status} ${response.statusText}).`,
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { content: null, reason: "AI returned an empty response." };
  }

  return { content, reason: null };
}

function parseStudyTips(text: string) {
  const tips = text
    .split("\n")
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return tips;
}

async function extractPdfText(pdfBytes: Uint8Array) {
  try {
    const pdfParseModule = (await import("pdf-parse")) as unknown as {
      default?: (data: Buffer) => Promise<{ text?: string }>;
    };

    const pdfParse = pdfParseModule.default;
    if (!pdfParse) {
      return null;
    }

    const result = await pdfParse(Buffer.from(pdfBytes));
    const text = result.text?.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      return null;
    }

    return text.slice(0, 12000);
  } catch {
    return null;
  }
}

export async function readMaterialFileText(fileUrl: string) {
  try {
    const extension = getFileExtension(fileUrl);
    const response = await fetch(fileUrl, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    const isPdf = extension === "pdf" || contentType.includes("application/pdf");
    if (isPdf) {
      const pdfBytes = new Uint8Array(await response.arrayBuffer());
      return await extractPdfText(pdfBytes);
    }

    if (!isTextLike(contentType, extension)) {
      return null;
    }

    const text = (await response.text()).trim();
    if (!text) {
      return null;
    }

    return text.slice(0, 8000);
  } catch {
    return null;
  }
}

export async function buildMaterialSummary(input: MaterialSummaryInput): Promise<MaterialSummary> {
  const fileText = input.fileUrl ? await readMaterialFileText(input.fileUrl) : null;

  const githubToken = process.env.GITHUB_TOKEN;
  const endpoint = process.env.GITHUB_MODEL_ENDPOINT || "https://models.inference.ai.azure.com";
  const modelName = process.env.GITHUB_MODEL_NAME || "gpt-4o-mini";

  if (!githubToken) {
    return buildUnavailableSummary(input, "Missing GITHUB_TOKEN in server environment.");
  }

  const promptContext = [
    `Title: ${input.title}`,
    `Description: ${input.description?.trim() || "No description provided."}`,
    `File excerpt: ${fileText ? fileText : "No readable file text available."}`,
  ].join("\n\n");

  try {
    const summaryResult = await requestAiText({
      endpoint,
      githubToken,
      modelName,
      systemPrompt: "You are a study assistant. Summarize study material in plain text.",
      userPrompt: `${promptContext}\n\nSummarize this material for a student in one short paragraph.`,
    });

    if (!summaryResult.content) {
      return buildUnavailableSummary(input, summaryResult.reason || "AI summary generation failed.");
    }

    if (isLowValueAiSummary(summaryResult.content)) {
      return buildUnavailableSummary(
        input,
        "AI response did not include useful material details.",
      );
    }

    const tipsResult = await requestAiText({
      endpoint,
      githubToken,
      modelName,
      systemPrompt: "You are a study assistant. Provide short practical study tips in plain text bullet list.",
      userPrompt: `${promptContext}\n\nProvide 4 short study tips for this material as bullet points only.`,
    });

    const parsedTips = tipsResult.content ? parseStudyTips(tipsResult.content) : [];

    return {
      summary: summaryResult.content,
      studyTips:
        parsedTips.length > 0
          ? parsedTips
          : [
              "Review the summary and identify the top 3 important ideas.",
              "Create quick self-quiz questions and answer without notes.",
              "Revisit weak areas and repeat after a short break.",
            ],
      source: "ai",
      reason: tipsResult.reason || undefined,
    };
  } catch {
    return buildUnavailableSummary(input, "AI request failed due to a network or server error.");
  }
}
