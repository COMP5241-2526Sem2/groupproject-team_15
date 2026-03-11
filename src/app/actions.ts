"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readMaterialFileText } from "@/lib/ai/material-summary";

export type GenerateAssessmentState = {
  generatedTitle: string;
  generatedPrompt: string;
  generatedAnswer: string;
  error?: string;
};

export type AssessmentHintState = {
  question: string;
  hint: string;
  error?: string;
};

const initialGeneratedAssessmentState: GenerateAssessmentState = {
  generatedTitle: "",
  generatedPrompt: "",
  generatedAnswer: "",
};

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
    temperature: 0.3,
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

function parseGeneratedAssessment(text: string): {
  generatedTitle: string;
  generatedPrompt: string;
  generatedAnswer: string;
} | null {
  try {
    const parsed = JSON.parse(text) as {
      title?: string;
      prompt?: string;
      answer?: string;
    };

    const generatedTitle = parsed.title?.trim() || "";
    const generatedPrompt = parsed.prompt?.trim() || "";
    const generatedAnswer = parsed.answer?.trim() || "";

    if (!generatedTitle || !generatedPrompt || !generatedAnswer) {
      return null;
    }

    return { generatedTitle, generatedPrompt, generatedAnswer };
  } catch {
    return null;
  }
}

function normalizeForCompare(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

function revealsAnswerDirectly(hint: string, answer: string) {
  const normalizedHint = normalizeForCompare(hint);
  const normalizedAnswer = normalizeForCompare(answer);

  if (!normalizedHint || !normalizedAnswer) {
    return false;
  }

  if (normalizedAnswer.length <= 140 && normalizedHint.includes(normalizedAnswer)) {
    return true;
  }

  const answerChunks = answer
    .split(/\n|\.|;|\?|!/)
    .map((chunk) => normalizeForCompare(chunk))
    .filter((chunk) => chunk.length >= 30);

  return answerChunks.some((chunk) => normalizedHint.includes(chunk));
}

export async function askAssessmentHintByAi(
  _: AssessmentHintState,
  formData: FormData,
): Promise<AssessmentHintState> {
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();

  if (!assessmentId || !question) {
    return {
      question,
      hint: "",
      error: "Please enter a question.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      question,
      hint: "",
      error: "Please log in again.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "student") {
    return {
      question,
      hint: "",
      error: "Only students can use this helper.",
    };
  }

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, prompt, answer")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) {
    return {
      question,
      hint: "",
      error: "Assessment not found.",
    };
  }

  const modelAnswer = assessment.answer?.trim() || "";
  if (!modelAnswer) {
    return {
      question,
      hint: "",
      error: "This assessment has no model answer yet, so AI hints are unavailable.",
    };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const endpoint = process.env.GITHUB_MODEL_ENDPOINT || "https://models.inference.ai.azure.com";
  const modelName = process.env.GITHUB_MODEL_NAME || "gpt-4o-mini";

  if (!githubToken) {
    return {
      question,
      hint: "",
      error: "Missing GITHUB_TOKEN in server environment.",
    };
  }

  const aiResult = await requestAiText({
    endpoint,
    githubToken,
    modelName,
    systemPrompt:
      "You are a tutoring assistant. Give scaffolded hints only. Never reveal final answers, exact solution text, or full step-by-step solved output.",
    userPrompt: [
      `Assessment prompt: ${assessment.prompt}`,
      `Teacher model answer (private reference): ${modelAnswer}`,
      `Student question: ${question}`,
      "Instruction: Reply with 2-4 short hint bullet points that guide the student. Do not give direct answer content or exact wording from the model answer.",
    ].join("\n\n"),
  });

  if (!aiResult.content) {
    return {
      question,
      hint: "",
      error: aiResult.reason || "AI helper is unavailable right now.",
    };
  }

  if (revealsAnswerDirectly(aiResult.content, modelAnswer)) {
    return {
      question,
      hint:
        "- Focus on the key concepts in the task and break your response into parts.\n- Explain why each part is relevant before writing your final response.\n- Use examples from the reference material to justify your ideas.",
      error: "I can only provide hints, not direct answers.",
    };
  }

  return {
    question,
    hint: aiResult.content,
    error: undefined,
  };
}

export async function generateAssessmentByAi(
  _: GenerateAssessmentState,
  formData: FormData,
): Promise<GenerateAssessmentState> {
  const referenceMaterialId = String(formData.get("referenceMaterialId") ?? "").trim();

  if (!referenceMaterialId) {
    return {
      ...initialGeneratedAssessmentState,
      error: "Please choose a reference material first.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ...initialGeneratedAssessmentState,
      error: "Please log in again.",
    };
  }

  const { data: material } = await supabase
    .from("materials")
    .select("title, description, file_url")
    .eq("id", referenceMaterialId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!material) {
    return {
      ...initialGeneratedAssessmentState,
      error: "Selected material was not found.",
    };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const endpoint = process.env.GITHUB_MODEL_ENDPOINT || "https://models.inference.ai.azure.com";
  const modelName = process.env.GITHUB_MODEL_NAME || "gpt-4o-mini";

  if (!githubToken) {
    return {
      ...initialGeneratedAssessmentState,
      error: "Missing GITHUB_TOKEN in server environment.",
    };
  }

  const materialText = material.file_url ? await readMaterialFileText(material.file_url) : null;

  const promptContext = [
    `Material title: ${material.title}`,
    `Material description: ${material.description?.trim() || "No description provided."}`,
    `Material excerpt: ${materialText || "No readable file text available."}`,
  ].join("\n\n");

  const aiResult = await requestAiText({
    endpoint,
    githubToken,
    modelName,
    systemPrompt:
      "You are an education assistant. Generate concise, practical teacher-ready assessments from provided learning material.",
    userPrompt: `${promptContext}\n\nGenerate one adaptive assessment related to the material. Return only valid minified JSON with this exact shape: {"title":"string","prompt":"string","answer":"string"}. The prompt must include 3 to 5 short related questions. The answer must provide model answers for each question in order.`,
  });

  if (!aiResult.content) {
    return {
      ...initialGeneratedAssessmentState,
      error: aiResult.reason || "AI could not generate an assessment.",
    };
  }

  const parsed = parseGeneratedAssessment(aiResult.content);
  if (!parsed) {
    return {
      ...initialGeneratedAssessmentState,
      error: "AI response format was invalid. Please try again.",
    };
  }

  return {
    ...parsed,
    error: undefined,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createMaterial(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const file = formData.get("file");

  if (!title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  let fileUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
    const baseName = file.name.replace(/\.[^/.]+$/, "").toLowerCase();
    const safeName = baseName.replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "file";
    const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}${extension ? `.${extension}` : ""}`;

    const { error: uploadError } = await supabase.storage
      .from("materials")
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw new Error(`Material upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("materials").getPublicUrl(filePath);
    fileUrl = publicUrlData.publicUrl;
  }

  await supabase.from("materials").insert({
    teacher_id: user.id,
    title,
    description: description || null,
    file_url: fileUrl,
  });

  revalidatePath("/teacher");
}

export async function createAssessment(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const referenceMaterialId = String(formData.get("referenceMaterialId") ?? "").trim();

  if (!title || !prompt) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  let validatedReferenceMaterialId: string | null = null;

  if (referenceMaterialId) {
    const { data: material } = await supabase
      .from("materials")
      .select("id")
      .eq("id", referenceMaterialId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (material) {
      validatedReferenceMaterialId = material.id;
    }
  }

  await supabase.from("assessments").insert({
    teacher_id: user.id,
    title,
    prompt,
    answer: answer || null,
    reference_material_id: validatedReferenceMaterialId,
  });

  revalidatePath("/teacher");
  revalidatePath("/student");
}

export async function submitanswer(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();

  if (!assessmentId || !answer) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("submissions").insert({
    assessment_id: assessmentId,
    student_id: user.id,
    answer,
  });

  revalidatePath("/student");
  revalidatePath("/teacher");
  redirect("/student");
}
