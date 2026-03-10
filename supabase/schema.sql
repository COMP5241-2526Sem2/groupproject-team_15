-- Extensions
create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('teacher', 'student')) default 'student',
  created_at timestamptz not null default now()
);

-- Study materials uploaded by teachers
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  file_url text,
  created_at timestamptz not null default now()
);

-- Adaptive assessments authored by teachers
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  prompt text not null,
  rubric text,
  created_at timestamptz not null default now()
);

-- Student thinking submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  thinking_process text not null,
  attempt_no int not null default 1,
  ai_feedback text,
  partial_score numeric(4,2),
  created_at timestamptz not null default now()
);

-- Detailed AI interaction records for teacher review
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  prompt_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Create profile row after a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.assessments enable row level security;
alter table public.submissions enable row level security;
alter table public.interactions enable row level security;

-- Profiles policies
create policy "users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

-- Materials policies
create policy "teachers can manage own materials"
on public.materials for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create policy "students can read materials"
on public.materials for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

-- Assessments policies
create policy "teachers can manage own assessments"
on public.assessments for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create policy "students can read assessments"
on public.assessments for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

-- Submissions policies
create policy "students can manage own submissions"
on public.submissions for all
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

create policy "teachers can read all submissions"
on public.submissions for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  )
);

-- Interactions policies
create policy "students can read own interactions"
on public.interactions for select
using (auth.uid() = student_id);

create policy "students can insert own interactions"
on public.interactions for insert
with check (auth.uid() = student_id);

create policy "teachers can read interactions"
on public.interactions for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  )
);
