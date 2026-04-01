import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buildMaterialSummary } from "@/lib/ai/material-summary";
import { createClient } from "@/lib/supabase/server";
import { SummarizeButton } from "./summarize-button";

function getFileExtension(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : "";
  } catch {
    return "";
  }
}

function getPreviewKind(url: string) {
  const extension = getFileExtension(url);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return "image" as const;
  }
  if (extension === "pdf") {
    return "pdf" as const;
  }
  return "unsupported" as const;
}

export default async function MaterialViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ summarize?: string }>;
}) {
  const { id } = await params;
  const { summarize } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, description, file_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!material) {
    notFound();
  }

  const shouldSummarize = summarize === "1";
  const summary = shouldSummarize
    ? await buildMaterialSummary({
        title: material.title,
        description: material.description,
        fileUrl: material.file_url,
      })
    : null;

  const previewKind = material.file_url ? getPreviewKind(material.file_url) : "unsupported";
  const backHref = profile?.role === "teacher" ? "/teacher" : "/student";

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
      <header className="glass-card flex items-center justify-between gap-4 p-6">
        <div>
          <span className="chip">Material Viewer</span>
          <h1 className="mt-2 text-3xl font-semibold">{material.title}</h1>
          <p className="text-sm">{material.description || "No description"}</p>
        </div>
        <Link href={backHref} className="btn-secondary">
          Back
        </Link>
      </header>

      <section className="glass-card p-6">
        {!material.file_url ? (
          <p className="text-sm">No file is attached to this material.</p>
        ) : previewKind === "image" ? (
          <img src={material.file_url} alt={material.title} className="max-h-[70vh] w-full rounded-lg object-contain" />
        ) : previewKind === "pdf" ? (
          <iframe
            src={material.file_url}
            title={material.title}
            className="h-[70vh] w-full rounded-lg border border-[var(--stroke)]"
          />
        ) : (
          <div className="space-y-3 text-sm">
            <p>Preview is not available for this file type.</p>
            <a href={material.file_url} className="btn-primary inline-flex" target="_blank" rel="noreferrer">
              Open file
            </a>
          </div>
        )}
      </section>

      <section className="glass-card space-y-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">AI Study Summary</h2>
          {summary ? <span className="chip">{summary.source === "ai" ? "AI Generated" : "Fallback"}</span> : null}
        </div>

        {!summary ? (
          <div className="space-y-3 text-sm">
            <p>Click the button to generate an AI summary for this material.</p>
            <SummarizeButton
              materialId={material.id}
              className="btn-primary"
              idleLabel="Summarize Material"
              loadingLabel="Generating Summary..."
            />
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">
              {summary.source === "ai"
                ? "Status: AI response received successfully."
                : `Status: AI unavailable. ${summary.reason || "Unknown reason."}`}
            </p>
            <p className="text-sm">{summary.summary}</p>

            {summary.studyTips.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Study Tips</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {summary.studyTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <SummarizeButton
              materialId={material.id}
              className="btn-secondary"
              idleLabel="Regenerate Summary"
              loadingLabel="Regenerating..."
            />
          </>
        )}
      </section>
    </main>
  );
}