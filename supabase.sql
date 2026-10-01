-- Supabase SQL Editor에서 한 번 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.rental_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default '기타',
  status text not null default '관심',
  brand text not null,
  product_name text not null,
  size text,
  monthly_rent numeric not null default 0,
  mandatory_months integer not null default 0,
  contract_months integer not null default 60,
  install_fee numeric not null default 0,
  initial_cost numeric not null default 0,
  card_name text,
  card_discount numeric not null default 0,
  discount_months integer not null default 0,
  cashback numeric not null default 0,
  extra_benefit numeric not null default 0,
  care_service text,
  care_cycle integer not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.rental_items enable row level security;
alter table public.admin_users enable row level security;

-- 로그인 사용자가 관리자 테이블에 있는지 확인.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 게스트: 조회 허용
drop policy if exists "public read rental items" on public.rental_items;
create policy "public read rental items"
on public.rental_items
for select
to anon, authenticated
using (true);

-- 관리자: 추가/수정/삭제 허용
drop policy if exists "admin insert rental items" on public.rental_items;
create policy "admin insert rental items"
on public.rental_items
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admin update rental items" on public.rental_items;
create policy "admin update rental items"
on public.rental_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin delete rental items" on public.rental_items;
create policy "admin delete rental items"
on public.rental_items
for delete
to authenticated
using (public.is_admin());

-- admin_users는 일반 클라이언트에서 직접 읽거나 수정할 필요 없음
drop policy if exists "no direct admin_users access" on public.admin_users;

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rental_items_updated_at on public.rental_items;
create trigger trg_rental_items_updated_at
before update on public.rental_items
for each row execute function public.set_updated_at();

-- 관리자 계정 생성 후 아래 SQL을 실행해 관리자 권한을 부여하세요.
-- Supabase > Authentication > Users에서 관리자 사용자의 UUID를 확인한 뒤 치환:
-- insert into public.admin_users(user_id) values ('여기에-관리자-USER-UUID');
