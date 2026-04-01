"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readMaterialFileText } from "@/lib/ai/material-summary";

export type GenerateAssessmentState = {
  generatedTitle: string;
  generatedPrompt: string;
  generatedAnswer: string;
  generatedQuestions: string[];
  generatedAnswers: string[];
  error?: string;
};

export type McQuestionItem = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
};

export type GenerateMcQuestionState = {
  generatedTitle: string;
  generatedItems: McQuestionItem[];
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
  generatedQuestions: [],
  generatedAnswers: [],
};

const initialGeneratedMcQuestionState: GenerateMcQuestionState = {
  generatedTitle: "",
  generatedItems: [],
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
  generatedQuestions: string[];
  generatedAnswers: string[];
} | null {
  try {
    const parsed = JSON.parse(text) as {
      title?: string;
      prompt?: string;
      answer?: string;
      questions?: string[];
      answers?: string[];
    };

    const normalizeItems = (items: string[] | undefined) =>
      (items ?? [])
        .map((item) =>
          String(item)
            .replace(/^\s*(?:question|answer|q|a)?\s*\d+[\s).:-]*/i, "")
            .replace(/^\s*[-*]\s*/, "")
            .trim(),
        )
        .filter(Boolean);

    const splitStructuredLines = (value: string) =>
      value
        .split(/\r?\n+/)
        .map((line) =>
          line
            .replace(/^\s*(?:question|answer|q|a)?\s*\d+[\s).:-]*/i, "")
            .replace(/^\s*[-*]\s*/, "")
            .trim(),
        )
        .filter(Boolean);

    const generatedTitle = parsed.title?.trim() || "";
    let generatedPrompt = parsed.prompt?.trim() || "";
    let generatedAnswer = parsed.answer?.trim() || "";

    let generatedQuestions = normalizeItems(parsed.questions);
    let generatedAnswers = normalizeItems(parsed.answers);

    if (generatedQuestions.length === 0 && generatedPrompt) {
      generatedQuestions = splitStructuredLines(generatedPrompt);
    }

    if (generatedAnswers.length === 0 && generatedAnswer) {
      generatedAnswers = splitStructuredLines(generatedAnswer);
    }

    if (!generatedPrompt && generatedQuestions.length > 0) {
      generatedPrompt = generatedQuestions.map((question, index) => `Q${index + 1}. ${question}`).join("\n");
    }

    if (!generatedAnswer && generatedAnswers.length > 0) {
      generatedAnswer = generatedAnswers.map((answer, index) => `A${index + 1}. ${answer}`).join("\n");
    }

    if (!generatedTitle || generatedQuestions.length === 0) {
      return null;
    }

    return {
      generatedTitle,
      generatedPrompt,
      generatedAnswer,
      generatedQuestions,
      generatedAnswers,
    };
  } catch {
    return null;
  }
}

function normalizeMcOption(value: string | null | undefined): "A" | "B" | "C" | "D" | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "A" || normalized === "B" || normalized === "C" || normalized === "D") {
    return normalized;
  }

  return null;
}

function parseGeneratedMcQuestions(text: string): {
  generatedTitle: string;
  generatedItems: McQuestionItem[];
} | null {
  try {
    const parsed = JSON.parse(text) as {
      title?: string;
      questions?: Array<{
        question?: string;
        options?: string[];
        optionA?: string;
        optionB?: string;
        optionC?: string;
        optionD?: string;
        correctOption?: string;
        answer?: string;
        explanation?: string;
      }>;
    };

    const generatedTitle = parsed.title?.trim() || "";
    const generatedItems = (parsed.questions ?? [])
      .map((item) => {
        const options = Array.isArray(item.options)
          ? item.options.map((option) => String(option).trim()).filter(Boolean)
          : [];

        const optionA = (item.optionA?.trim() || options[0] || "").trim();
        const optionB = (item.optionB?.trim() || options[1] || "").trim();
        const optionC = (item.optionC?.trim() || options[2] || "").trim();
        const optionD = (item.optionD?.trim() || options[3] || "").trim();
        const correctOption = normalizeMcOption(item.correctOption ?? item.answer);

        if (!item.question?.trim() || !optionA || !optionB || !optionC || !optionD || !correctOption) {
          return null;
        }

        return {
          question: item.question.trim(),
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          explanation: item.explanation?.trim() || "",
        } satisfies McQuestionItem;
      })
      .filter((item): item is McQuestionItem => Boolean(item));

    if (!generatedTitle || generatedItems.length === 0) {
      return null;
    }

    return {
      generatedTitle,
      generatedItems,
    };
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
  const referenceMaterialIds = formData
    .getAll("referenceMaterialIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const questionCountRaw = String(formData.get("questionCount") ?? "").trim();
  const requestedQuestionCount = Number.parseInt(questionCountRaw, 10);

  const existingPrompt = String(formData.get("prompt") ?? "").trim();
  const validExistingQuestionsCount = existingPrompt
    .split(/\r?\n+/)
    .filter((line) => line.trim().length > 0).length;

  const existingAnswers = String(formData.get("answer") ?? "").trim();

  if (!questionCountRaw || !Number.isFinite(requestedQuestionCount) || requestedQuestionCount < 1) {
    return {
      ...initialGeneratedAssessmentState,
      error: "Please enter how many questions to generate.",
    };
  }

  const requiredCount = Math.max(0, requestedQuestionCount - validExistingQuestionsCount);

  if (requiredCount === 0) {
    return {
      generatedTitle: String(formData.get("title") ?? "").trim(),
      generatedPrompt: "",
      generatedAnswer: "",
      generatedQuestions: [],
      generatedAnswers: [],
      error: undefined,
    };
  }

  if (referenceMaterialIds.length === 0) {
    return {
      ...initialGeneratedAssessmentState,
      error: "Please choose at least one reference material first.",
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

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, file_url")
    .in("id", referenceMaterialIds)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: true });

  if (!materials || materials.length === 0) {
    return {
      ...initialGeneratedAssessmentState,
      error: "Selected reference materials were not found.",
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

  const promptChunks = await Promise.all(
    materials.map(async (material, index) => {
      const materialText = material.file_url ? await readMaterialFileText(material.file_url) : null;

      return [
        `Material ${index + 1} title: ${material.title}`,
        `Material ${index + 1} description: ${material.description?.trim() || "No description provided."}`,
        `Material ${index + 1} excerpt: ${materialText || "No readable file text available."}`,
      ].join("\n");
    }),
  );

  const promptContext = promptChunks.join("\n\n");

  const aiResult = await requestAiText({
    endpoint,
    githubToken,
    modelName,
    systemPrompt:
      "You are an education assistant. Generate concise, practical teacher-ready assessments from provided learning material.",
    userPrompt: `${promptContext}\n\nGenerate one adaptive assessment related to the material. Return only valid minified JSON with this exact shape: {"title":"string","questions":["string"],"answers":["string"]}. Include exactly ${requiredCount} short related questions in \"questions\". Include model answers in \"answers\" with the same order and exact same count as questions.`,
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

export async function generateMcQuestionsByAi(
  _: GenerateMcQuestionState,
  formData: FormData,
): Promise<GenerateMcQuestionState> {
  const referenceMaterialIds = formData
    .getAll("referenceMaterialIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const questionCountRaw = String(formData.get("questionCount") ?? "").trim();
  const requestedQuestionCount = Number.parseInt(questionCountRaw, 10);
  
  const existingTitle = String(formData.get("title") ?? "").trim();
  const itemsJson = String(formData.get("itemsJson") ?? "[]");
  let existingItems: McQuestionItem[] = [];
  try {
    existingItems = JSON.parse(itemsJson);
  } catch {}

  const validExistingItems = existingItems.filter(
    (item) => item.question.trim().length > 0 
  );

  if (!questionCountRaw || !Number.isFinite(requestedQuestionCount) || requestedQuestionCount < 1) {
    return {
      ...initialGeneratedMcQuestionState,
      error: "Please enter how many MC questions to generate.",
    };
  }

  const requiredCount = Math.max(0, requestedQuestionCount - validExistingItems.length);

  if (requiredCount === 0) {
    return {
      generatedTitle: existingTitle,
      generatedItems: validExistingItems,
      error: undefined,
    };
  }

  if (referenceMaterialIds.length === 0) {
    return {
      ...initialGeneratedMcQuestionState,
      error: "Please choose at least one reference material first.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ...initialGeneratedMcQuestionState,
      error: "Please log in again.",
    };
  }

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, file_url")
    .in("id", referenceMaterialIds)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: true });

  if (!materials || materials.length === 0) {
    return {
      ...initialGeneratedMcQuestionState,
      error: "Selected reference materials were not found.",
    };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const endpoint = process.env.GITHUB_MODEL_ENDPOINT || "https://models.inference.ai.azure.com";
  const modelName = process.env.GITHUB_MODEL_NAME || "gpt-4o-mini";

  if (!githubToken) {
    return {
      ...initialGeneratedMcQuestionState,
      error: "Missing GITHUB_TOKEN in server environment.",
    };
  }

  const promptChunks = await Promise.all(
    materials.map(async (material, index) => {
      const materialText = material.file_url ? await readMaterialFileText(material.file_url) : null;

      return [
        `Material ${index + 1} title: ${material.title}`,
        `Material ${index + 1} description: ${material.description?.trim() || "No description provided."}`,
        `Material ${index + 1} excerpt: ${materialText || "No readable file text available."}`,
      ].join("\n");
    }),
  );

  const promptContext = promptChunks.join("\n\n");

  const aiResult = await requestAiText({
    endpoint,
    githubToken,
    modelName,
    systemPrompt:
      "You are an education assistant. Generate clear multiple-choice questions grounded in provided learning material.",
    userPrompt:
      `${promptContext}\n\n` +
      `Generate exactly ${requiredCount} multiple-choice questions that combine and connect ideas across the provided materials. ` +
      "Return only valid minified JSON with this exact shape: " +
      '{"title":"string","questions":[{"question":"string","optionA":"string","optionB":"string","optionC":"string","optionD":"string","correctOption":"A|B|C|D","explanation":"string"}]}. ' +
      "The questions array length must equal the requested count.",
  });

  if (!aiResult.content) {
    return {
      ...initialGeneratedMcQuestionState,
      error: aiResult.reason || "AI could not generate MC questions.",
    };
  }

  const parsed = parseGeneratedMcQuestions(aiResult.content);
  if (!parsed || parsed.generatedItems.length !== requiredCount) {
    return {
      ...initialGeneratedMcQuestionState,
      error: "AI response format or question count was invalid. Please try again.",
    };
  }

  return {
    generatedTitle: existingTitle || parsed.generatedTitle,
    generatedItems: [...validExistingItems, ...parsed.generatedItems],
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
  redirect("/teacher");
}

export async function updateAssessment(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const referenceMaterialId = String(formData.get("referenceMaterialId") ?? "").trim();

  if (!assessmentId || !title || !prompt) return;

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

  await supabase
    .from("assessments")
    .update({
      title,
      prompt,
      answer: answer || null,
      reference_material_id: validatedReferenceMaterialId,
    })
    .eq("id", assessmentId)
    .eq("teacher_id", user.id);

  revalidatePath("/teacher");
  revalidatePath("/student");
  redirect("/teacher");
}

export async function createMcQuestions(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const itemsJson = String(formData.get("itemsJson") ?? "").trim();
  const referenceMaterialId = String(formData.get("referenceMaterialId") ?? "").trim();

  if (!title || !itemsJson) return;

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(itemsJson);
  } catch {
    return;
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) return;

  const normalizedItems = parsedItems
    .map((item) => {
      const row = item as Partial<McQuestionItem>;
      const correctOption = normalizeMcOption(row.correctOption);

      if (
        !row.question?.trim() ||
        !row.optionA?.trim() ||
        !row.optionB?.trim() ||
        !row.optionC?.trim() ||
        !row.optionD?.trim() ||
        !correctOption
      ) {
        return null;
      }

      return {
        question: row.question.trim(),
        optionA: row.optionA.trim(),
        optionB: row.optionB.trim(),
        optionC: row.optionC.trim(),
        optionD: row.optionD.trim(),
        correctOption,
        explanation: row.explanation?.trim() || "",
      };
    })
    .filter(
      (
        item,
      ): item is {
        question: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctOption: "A" | "B" | "C" | "D";
        explanation: string;
      } => Boolean(item),
    );

  if (normalizedItems.length === 0) return;

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

  const { data: createdSet, error: createSetError } = await supabase
    .from("mc_sets")
    .insert({
      teacher_id: user.id,
      title,
      reference_material_id: validatedReferenceMaterialId,
    })
    .select("id")
    .single();

  if (createSetError || !createdSet) {
    throw new Error(`MC set creation failed: ${createSetError?.message || "Unknown error"}`);
  }

  await supabase.from("mc_questions").insert(
    normalizedItems.map((item) => ({
      set_id: createdSet.id,
      teacher_id: user.id,
      title,
      question: item.question,
      option_a: item.optionA,
      option_b: item.optionB,
      option_c: item.optionC,
      option_d: item.optionD,
      correct_option: item.correctOption,
      explanation: item.explanation || null,
      reference_material_id: validatedReferenceMaterialId,
    })),
  );

  revalidatePath("/teacher");
  revalidatePath("/student");
  redirect("/teacher");
}

export async function updateMcQuestions(formData: FormData) {
  const setId = String(formData.get("setId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const itemsJson = String(formData.get("itemsJson") ?? "").trim();
  const referenceMaterialId = String(formData.get("referenceMaterialId") ?? "").trim();

  if (!setId || !title || !itemsJson) return;

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(itemsJson);
  } catch {
    return;
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) return;

  const normalizedItems = parsedItems
    .map((item) => {
      const row = item as Partial<McQuestionItem>;
      const correctOption = normalizeMcOption(row.correctOption);

      if (
        !row.question?.trim() ||
        !row.optionA?.trim() ||
        !row.optionB?.trim() ||
        !row.optionC?.trim() ||
        !row.optionD?.trim() ||
        !correctOption
      ) {
        return null;
      }

      return {
        question: row.question.trim(),
        optionA: row.optionA.trim(),
        optionB: row.optionB.trim(),
        optionC: row.optionC.trim(),
        optionD: row.optionD.trim(),
        correctOption,
        explanation: row.explanation?.trim() || "",
      };
    })
    .filter(
      (item): item is {
        question: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctOption: "A" | "B" | "C" | "D";
        explanation: string;
      } => Boolean(item),
    );

  if (normalizedItems.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Verify the MC Set belongs to the user
  const { data: existingSet } = await supabase
    .from("mc_sets")
    .select("id")
    .eq("id", setId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!existingSet) return;

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

  await supabase
    .from("mc_sets")
    .update({
      title,
      reference_material_id: validatedReferenceMaterialId,
    })
    .eq("id", setId);

  // Delete old questions to replace them entirely
  await supabase.from("mc_questions").delete().eq("set_id", setId);

  await supabase.from("mc_questions").insert(
    normalizedItems.map((item) => ({
      set_id: setId,
      teacher_id: user.id,
      title,
      question: item.question,
      option_a: item.optionA,
      option_b: item.optionB,
      option_c: item.optionC,
      option_d: item.optionD,
      correct_option: item.correctOption,
      explanation: item.explanation || null,
      reference_material_id: validatedReferenceMaterialId,
    })),
  );

  revalidatePath("/teacher");
  revalidatePath("/student");
  redirect("/teacher");
}

export async function deleteMaterial(formData: FormData) {
  const materialId = String(formData.get("materialId") ?? "").trim();

  if (!materialId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: material } = await supabase
    .from("materials")
    .select("id, file_url")
    .eq("id", materialId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!material) return;

  await supabase.from("materials").delete().eq("id", material.id).eq("teacher_id", user.id);

  if (material.file_url) {
    try {
      const url = new URL(material.file_url);
      const marker = "/storage/v1/object/public/materials/";
      const markerIndex = url.pathname.indexOf(marker);

      if (markerIndex !== -1) {
        const objectPath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
        if (objectPath) {
          await supabase.storage.from("materials").remove([objectPath]);
        }
      }
    } catch {
      // Ignore malformed URLs and continue.
    }
  }

  revalidatePath("/teacher");
  revalidatePath("/student");
}

export async function deleteAssessment(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();

  if (!assessmentId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("assessments")
    .delete()
    .eq("id", assessmentId)
    .eq("teacher_id", user.id);

  revalidatePath("/teacher");
  revalidatePath("/student");
}

export async function deleteMcSet(formData: FormData) {
  const mcSetId = String(formData.get("mcSetId") ?? "").trim();

  if (!mcSetId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("mc_sets")
    .delete()
    .eq("id", mcSetId)
    .eq("teacher_id", user.id);

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

export async function submitMcAnswers(formData: FormData) {
  const setId = String(formData.get("setId") ?? "").trim();

  if (!setId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: questions } = await supabase
    .from("mc_questions")
    .select("id, correct_option")
    .eq("set_id", setId)
    .order("created_at", { ascending: true });

  if (!questions?.length) return;

  const submissions = questions
    .map((question) => {
      const selected = String(formData.get(`answer_${question.id}`) ?? "").trim().toUpperCase();
      if (selected !== "A" && selected !== "B" && selected !== "C" && selected !== "D") {
        return null;
      }

      return {
        set_id: setId,
        question_id: question.id,
        student_id: user.id,
        selected_option: selected,
        is_correct: selected === question.correct_option,
      };
    })
    .filter(
      (
        row,
      ): row is {
        set_id: string;
        question_id: string;
        student_id: string;
        selected_option: "A" | "B" | "C" | "D";
        is_correct: boolean;
      } => Boolean(row),
    );

  if (submissions.length !== questions.length) {
    return;
  }

  await supabase.from("mc_submissions").insert(submissions);

  revalidatePath("/student");
  revalidatePath("/teacher");
  redirect("/student");
}
