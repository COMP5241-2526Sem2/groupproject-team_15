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
  answer text,
  reference_material_id uuid references public.materials(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Multiple-choice questions authored by teachers
create table if not exists public.mc_sets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  reference_material_id uuid references public.materials(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Multiple-choice questions belonging to a set
create table if not exists public.mc_questions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid references public.mc_sets(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  reference_material_id uuid references public.materials(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.mc_questions
add column if not exists set_id uuid references public.mc_sets(id) on delete cascade;

alter table public.assessments
add column if not exists answer text;

alter table public.assessments
add column if not exists reference_material_id uuid references public.materials(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assessments'
      and column_name = 'rubric'
  ) then
    execute 'update public.assessments set answer = rubric where answer is null and rubric is not null';
  end if;
end;
$$;

-- Student submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null,
  attempt_no int not null default 1,
  created_at timestamptz not null default now()
);

-- Student MC submissions
create table if not exists public.mc_submissions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.mc_sets(id) on delete cascade,
  question_id uuid not null references public.mc_questions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.submissions
add column if not exists answer text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'submissions'
      and column_name = 'thinking_process'
  ) then
    execute 'update public.submissions set answer = coalesce(answer, thinking_process, '''') where answer is null';
  else
    update public.submissions
    set answer = ''
    where answer is null;
  end if;
end;
$$;

alter table public.submissions
alter column answer set not null;

alter table public.submissions
drop column if exists thinking_process;

alter table public.submissions
add column if not exists mark text;

drop table if exists public.interactions;

-- Storage bucket for teacher-uploaded study materials
insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict (id) do nothing;

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
alter table public.mc_sets enable row level security;
alter table public.mc_questions enable row level security;
alter table public.mc_submissions enable row level security;
alter table public.submissions enable row level security;

-- Profiles policies
create policy "users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create or replace function public.is_teacher_role(user_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = user_id and role = 'teacher'
  );
$$ language sql security definer;

create policy "teachers can view student profiles"
on public.profiles for select
using (
  public.is_teacher_role(auth.uid())
  and role = 'student'
);

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

-- MC questions policies
create policy "teachers can manage own mc sets"
on public.mc_sets for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create policy "students can read mc sets"
on public.mc_sets for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

create policy "teachers can manage own mc questions"
on public.mc_questions for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create policy "students can read mc questions"
on public.mc_questions for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  )
);

create policy "students can manage own mc submissions"
on public.mc_submissions for all
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

create policy "teachers can read all mc submissions"
on public.mc_submissions for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
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

-- Storage policies (materials bucket)
drop policy if exists "authenticated can read materials files" on storage.objects;
create policy "authenticated can read materials files"
on storage.objects for select
using (
  bucket_id = 'materials'
  and auth.role() = 'authenticated'
);

drop policy if exists "teachers can upload own material files" on storage.objects;
create policy "teachers can upload own material files"
on storage.objects for insert
with check (
  bucket_id = 'materials'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  )
);

drop policy if exists "teachers can update own material files" on storage.objects;
create policy "teachers can update own material files"
on storage.objects for update
using (
  bucket_id = 'materials'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  )
)
with check (
  bucket_id = 'materials'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  )
);

drop policy if exists "teachers can delete own material files" on storage.objects;
create policy "teachers can delete own material files"
on storage.objects for delete
using (
  bucket_id = 'materials'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  )
);
