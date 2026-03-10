import Link from "next/link";

const highlights = [
  "Students submit full thinking process before hints",
  "AI gives Socratic prompts and tiered guidance",
  "Teachers track mastery, errors, and partial-credit progress",
  "Retrieval-ready architecture to ground answers in class content",
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
      <section className="glass-card fade-in grid gap-8 p-8 md:grid-cols-[1.1fr_0.9fr] md:p-12">
        <div className="space-y-5">
          <span className="chip">AI Learning Platform</span>
          <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">
            ThinkPath: make student reasoning visible, not just final answers.
          </h1>
          <p className="max-w-2xl text-lg">
            A role-based platform for teachers and students. Teachers publish
            materials and adaptive assessments, while students submit step-by-step
            thinking and receive scaffolded AI coaching.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/login" className="btn-primary">
              Start with Role Login
            </Link>
            <a href="#features" className="btn-secondary">
              Explore Features
            </a>
          </div>
        </div>

        <div className="glass-card border-2 border-[var(--sun)] bg-[color:var(--sun)]/15 p-6">
          <h2 className="text-2xl font-semibold">Why this works</h2>
          <ul className="mt-4 space-y-3 text-sm sm:text-base">
            {highlights.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">●</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="mt-10 grid gap-5 md:grid-cols-2">
        <article className="glass-card fade-in p-6" style={{ animationDelay: "120ms" }}>
          <h3 className="text-2xl">Thinking Guide</h3>
          <p className="mt-2">
            Students must provide text, step lists, or OCR-derived notes before
            hints unlock. AI responds with Socratic checks, not direct answers.
          </p>
        </article>
        <article className="glass-card fade-in p-6" style={{ animationDelay: "220ms" }}>
          <h3 className="text-2xl">Teacher Dashboard</h3>
          <p className="mt-2">
            Upload study resources, create adaptive assessments, and inspect common
            error patterns with export-ready records.
          </p>
        </article>
        <article className="glass-card fade-in p-6" style={{ animationDelay: "320ms" }}>
          <h3 className="text-2xl">Partial-credit Grading</h3>
          <p className="mt-2">
            Student attempts and AI feedback are stored for procedural grading and
            transparent review.
          </p>
        </article>
        <article className="glass-card fade-in p-6" style={{ animationDelay: "420ms" }}>
          <h3 className="text-2xl">Safe by Design</h3>
          <p className="mt-2">
            Includes role-based access, Supabase row-level security, and architecture
            prepared for privacy and compliance workflows.
          </p>
        </article>
      </section>
    </main>
  );
}
