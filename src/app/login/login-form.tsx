"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await signInWithPassword();
  }

  async function signInWithPassword() {
    setStatus("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp() {
    setStatus("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: fullName,
          },
          emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
        },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setStatus(
          "Account created. If login fails due to email confirmation, disable 'Confirm email' in Supabase Auth settings.",
        );
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold">Email</label>
        <input
          className="field"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="student@school.edu"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">Password</label>
        <input
          className="field"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
        />
      </div>

  

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Login as</legend>
        <div className="flex gap-3">
          <label className="chip cursor-pointer gap-2">
            <input
              type="radio"
              name="role"
              checked={role === "student"}
              onChange={() => setRole("student")}
            />
            Student
          </label>
          <label className="chip cursor-pointer gap-2">
            <input
              type="radio"
              name="role"
              checked={role === "teacher"}
              onChange={() => setRole("teacher")}
            />
            Teacher
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button className="btn-primary w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Please wait..." : "Sign In"}
        </button>
        <button
          className="btn-secondary w-full"
          type="button"
          onClick={handleSignUp}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Please wait..." : "Sign Up"}
        </button>
      </div>

      {status ? <p className="text-sm font-medium">{status}</p> : null}
    </form>
  );
}
