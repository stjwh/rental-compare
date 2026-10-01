-- 렌탈 비교 앱 보안 강화 SQL
-- 기존 데이터 유지용. Supabase SQL Editor에서 실행하세요.

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
  public_memo text,
  admin_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 기존 memo 컬럼이 있으면 데이터 보존 상태로 public_memo로 변경
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='rental_items' and column_name='memo'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='rental_items' and column_name='public_memo'
  ) then
    alter table public.rental_items rename column memo to public_memo;
  end if;
end $$;

alter table public.rental_items add column if not exists public_memo text;
alter table public.rental_items add column if not exists admin_memo text;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.rental_items enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 원본 테이블은 게스트가 직접 읽지 못하도록 권한 제거
revoke all on table public.rental_items from anon, authenticated;
grant select, insert, update, delete on table public.rental_items to authenticated;

-- admin_users는 브라우저에서 직접 조회/수정 금지
revoke all on table public.admin_users from anon, authenticated;

-- 기존 공개 SELECT 정책 제거
drop policy if exists "public read rental items" on public.rental_items;
drop policy if exists "admin select rental items" on public.rental_items;

-- 원본 테이블 조회는 관리자만
create policy "admin select rental items"
on public.rental_items
for select
to authenticated
using (public.is_admin());

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

-- 게스트용 공개 View: admin_memo / created_at 등 비공개 필드는 제외
drop view if exists public.rental_items_public;
create view public.rental_items_public
with (security_barrier = true)
as
select
  id,
  category,
  status,
  brand,
  product_name,
  size,
  monthly_rent,
  mandatory_months,
  contract_months,
  install_fee,
  initial_cost,
  card_name,
  card_discount,
  discount_months,
  cashback,
  extra_benefit,
  care_service,
  care_cycle,
  public_memo,
  updated_at
from public.rental_items;

revoke all on table public.rental_items_public from public, anon, authenticated;
grant select on table public.rental_items_public to anon, authenticated;

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

-- 관리자 등록 예시:
-- insert into public.admin_users(user_id) values ('관리자-USER-UUID')
-- on conflict (user_id) do nothing;
