import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl place-items-center px-6 py-10">
      <section className="glass-card grid w-full gap-8 p-8 md:grid-cols-2 md:p-10">
        <div>
          <span className="chip">Role-based Access</span>
          <h1 className="mt-3 text-4xl leading-tight font-semibold">
            Sign in to ThinkPath
          </h1>
          <p className="mt-3">
            Teacher accounts can upload materials and create assessments. Student
            accounts submit thinking steps and receive scaffolded AI prompts.
          </p>
          <p className="mt-6 text-sm">
            Use Email + Password to sign in directly. New users can create an
            account and choose role on signup.
          </p>
          <Link className="mt-6 inline-block text-sm font-semibold underline" href="/">
            Back to platform overview
          </Link>
        </div>

        <div className="glass-card p-5">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
