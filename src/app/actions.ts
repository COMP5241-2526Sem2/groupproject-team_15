"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildScaffoldedFeedback } from "@/lib/ai/scaffold";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createMaterial(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();

  if (!title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("materials").insert({
    teacher_id: user.id,
    title,
    description: description || null,
    file_url: fileUrl || null,
  });

  revalidatePath("/teacher");
}

export async function createAssessment(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const rubric = String(formData.get("rubric") ?? "").trim();

  if (!title || !prompt) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("assessments").insert({
    teacher_id: user.id,
    title,
    prompt,
    rubric: rubric || null,
  });

  revalidatePath("/teacher");
  revalidatePath("/student");
}

export async function submitThinking(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const thinkingProcess = String(formData.get("thinkingProcess") ?? "").trim();

  if (!assessmentId || !thinkingProcess) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId)
    .eq("student_id", user.id);

  const attemptNo = (count ?? 0) + 1;
  const feedback = buildScaffoldedFeedback(thinkingProcess, attemptNo);

  const { data: submission } = await supabase
    .from("submissions")
    .insert({
      assessment_id: assessmentId,
      student_id: user.id,
      thinking_process: thinkingProcess,
      attempt_no: attemptNo,
      ai_feedback: feedback.prompt,
      partial_score: feedback.partialCredit,
    })
    .select("id")
    .single();

  if (submission) {
    await supabase.from("interactions").insert({
      submission_id: submission.id,
      student_id: user.id,
      prompt_type: feedback.promptType,
      content: feedback.prompt,
    });
  }

  revalidatePath("/student");
  revalidatePath("/teacher");
}
