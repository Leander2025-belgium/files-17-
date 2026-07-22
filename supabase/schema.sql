create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  home_location_name text,
  home_latitude numeric,
  home_longitude numeric,
  language text default 'nl',
  temperature_unit text default 'C',
  wind_unit text default 'kmh',
  pressure_unit text default 'hpa',
  precipitation_unit text default 'mm',
  forecast_days integer default 7 check (forecast_days in (7, 14)),
  weather_model text default 'knmi_seamless',
  notifications_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.favorite_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  latitude numeric not null,
  longitude numeric not null,
  country text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  location_name text,
  latitude numeric,
  longitude numeric,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.personal_weather_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  location_name text not null,
  latitude_rounded numeric,
  longitude_rounded numeric,
  min_temperature numeric,
  max_temperature numeric,
  mean_temperature numeric,
  precipitation_total numeric,
  max_wind_gust numeric,
  uv_max numeric,
  weather_code integer,
  warning_count integer default 0,
  source_name text,
  data_quality text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date, location_name)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists personal_weather_days_set_updated_at on public.personal_weather_days;
create trigger personal_weather_days_set_updated_at
before update on public.personal_weather_days
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.favorite_locations enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.personal_weather_days enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can view own favorites" on public.favorite_locations;
create policy "Users can view own favorites"
on public.favorite_locations for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own favorites" on public.favorite_locations;
create policy "Users can insert own favorites"
on public.favorite_locations for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own favorites" on public.favorite_locations;
create policy "Users can update own favorites"
on public.favorite_locations for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own favorites" on public.favorite_locations;
create policy "Users can delete own favorites"
on public.favorite_locations for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
create policy "Users can view own push subscriptions"
on public.push_subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
on public.push_subscriptions for insert
with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
on public.push_subscriptions for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own personal weather days" on public.personal_weather_days;
create policy "Users can view own personal weather days"
on public.personal_weather_days for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own personal weather days" on public.personal_weather_days;
create policy "Users can insert own personal weather days"
on public.personal_weather_days for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own personal weather days" on public.personal_weather_days;
create policy "Users can update own personal weather days"
on public.personal_weather_days for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own personal weather days" on public.personal_weather_days;
create policy "Users can delete own personal weather days"
on public.personal_weather_days for delete
using (auth.uid() = user_id);

create index if not exists personal_weather_days_user_date_idx on public.personal_weather_days (user_id, date);
create index if not exists personal_weather_days_user_location_idx on public.personal_weather_days (user_id, location_name);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  photo_path text not null,
  caption text,
  category text not null default 'other',
  hashtags text[] default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  location_privacy text not null default 'municipality' check (location_privacy in ('exact', 'municipality', 'none')),
  location_name text,
  latitude numeric,
  longitude numeric,
  temperature numeric,
  apparent_temperature numeric,
  wind_speed numeric,
  precipitation numeric,
  humidity numeric,
  uv_index numeric,
  pressure numeric,
  weather_source text,
  moderation_status text not null default 'approved' check (moderation_status in ('pending', 'approved', 'hidden', 'rejected')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  favorite_count integer not null default 0,
  report_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.community_comments(id) on delete cascade,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create table if not exists public.community_favorites (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create table if not exists public.community_followers (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.community_posts(id) on delete cascade,
  type text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.community_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  label text not null,
  awarded_at timestamptz default now(),
  unique (user_id, badge_key)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz default now(),
  unique (post_id, reporter_id)
);

create table if not exists public.community_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace view public.community_public_profiles
as
select
  id,
  coalesce(display_name, 'Weerscoop gebruiker') as display_name,
  avatar_url
from public.profiles;

grant select on public.community_public_profiles to anon, authenticated;

create index if not exists community_posts_created_idx on public.community_posts (created_at desc);
create index if not exists community_posts_category_idx on public.community_posts (category, created_at desc);
create index if not exists community_posts_location_idx on public.community_posts (location_name);
create index if not exists community_posts_hashtags_idx on public.community_posts using gin (hashtags);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

drop trigger if exists community_comments_set_updated_at on public.community_comments;
create trigger community_comments_set_updated_at
before update on public.community_comments
for each row execute function public.set_updated_at();

create or replace function public.refresh_community_post_counts(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_posts
  set like_count = (select count(*) from public.community_likes where post_id = target_post_id),
      comment_count = (select count(*) from public.community_comments where post_id = target_post_id),
      favorite_count = (select count(*) from public.community_favorites where post_id = target_post_id),
      report_count = (select count(*) from public.community_reports where post_id = target_post_id)
  where id = target_post_id;
end;
$$;

create or replace function public.community_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  target_post_id = coalesce(new.post_id, old.post_id);
  perform public.refresh_community_post_counts(target_post_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists community_likes_count on public.community_likes;
create trigger community_likes_count
after insert or delete on public.community_likes
for each row execute function public.community_count_trigger();

drop trigger if exists community_comments_count on public.community_comments;
create trigger community_comments_count
after insert or delete on public.community_comments
for each row execute function public.community_count_trigger();

drop trigger if exists community_favorites_count on public.community_favorites;
create trigger community_favorites_count
after insert or delete on public.community_favorites
for each row execute function public.community_count_trigger();

drop trigger if exists community_reports_count on public.community_reports;
create trigger community_reports_count
after insert or delete on public.community_reports
for each row execute function public.community_count_trigger();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_favorites enable row level security;
alter table public.community_followers enable row level security;
alter table public.community_notifications enable row level security;
alter table public.community_badges enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_blocks enable row level security;

drop policy if exists "Anyone can view approved public community posts" on public.community_posts;
create policy "Anyone can view approved public community posts"
on public.community_posts for select
using (visibility = 'public' and moderation_status = 'approved');

drop policy if exists "Users can insert own community posts" on public.community_posts;
create policy "Users can insert own community posts"
on public.community_posts for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own community posts" on public.community_posts;
create policy "Users can update own community posts"
on public.community_posts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own community posts" on public.community_posts;
create policy "Users can delete own community posts"
on public.community_posts for delete
using (auth.uid() = user_id);

drop policy if exists "Anyone can view comments on approved posts" on public.community_comments;
create policy "Anyone can view comments on approved posts"
on public.community_comments for select
using (exists (select 1 from public.community_posts p where p.id = post_id and p.visibility = 'public' and p.moderation_status = 'approved'));

drop policy if exists "Users can insert own comments" on public.community_comments;
create policy "Users can insert own comments"
on public.community_comments for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own comments" on public.community_comments;
create policy "Users can delete own comments"
on public.community_comments for delete
using (auth.uid() = user_id);

drop policy if exists "Anyone can view community likes" on public.community_likes;
create policy "Anyone can view community likes"
on public.community_likes for select
using (true);

drop policy if exists "Users can manage own likes" on public.community_likes;
create policy "Users can manage own likes"
on public.community_likes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can view own saved community photos" on public.community_favorites;
create policy "Users can view own saved community photos"
on public.community_favorites for select
using (auth.uid() = user_id);

drop policy if exists "Users can manage own saved community photos" on public.community_favorites;
create policy "Users can manage own saved community photos"
on public.community_favorites for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can view follows involving self" on public.community_followers;
create policy "Users can view follows involving self"
on public.community_followers for select
using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "Users can manage own following" on public.community_followers;
create policy "Users can manage own following"
on public.community_followers for all
using (auth.uid() = follower_id)
with check (auth.uid() = follower_id);

drop policy if exists "Users can view own community notifications" on public.community_notifications;
create policy "Users can view own community notifications"
on public.community_notifications for select
using (auth.uid() = user_id);

drop policy if exists "Users can update own community notifications" on public.community_notifications;
create policy "Users can update own community notifications"
on public.community_notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can view own badges" on public.community_badges;
create policy "Users can view own badges"
on public.community_badges for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own reports" on public.community_reports;
create policy "Users can insert own reports"
on public.community_reports for insert
with check (auth.uid() = reporter_id);

drop policy if exists "Users can manage own community blocks" on public.community_blocks;
create policy "Users can manage own community blocks"
on public.community_blocks for all
using (auth.uid() = blocker_id)
with check (auth.uid() = blocker_id);

create or replace function public.create_community_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  actor uuid;
  notif_type text;
  notif_body text;
begin
  if tg_table_name = 'community_likes' then
    actor = new.user_id;
    notif_type = 'like';
    notif_body = 'Iemand vindt je weerfoto leuk.';
  elsif tg_table_name = 'community_comments' then
    actor = new.user_id;
    notif_type = 'comment';
    notif_body = 'Iemand reageerde op je weerfoto.';
  else
    return new;
  end if;

  select user_id into owner_id from public.community_posts where id = new.post_id;
  if owner_id is null or owner_id = actor then
    return new;
  end if;

  insert into public.community_notifications (user_id, actor_id, post_id, type, body)
  values (owner_id, actor, new.post_id, notif_type, notif_body);
  return new;
end;
$$;

drop trigger if exists community_likes_notify on public.community_likes;
create trigger community_likes_notify
after insert on public.community_likes
for each row execute function public.create_community_notification();

drop trigger if exists community_comments_notify on public.community_comments;
create trigger community_comments_notify
after insert on public.community_comments
for each row execute function public.create_community_notification();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-photos',
  'community-photos',
  true,
  8388608,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Community photos are publicly readable" on storage.objects;
create policy "Community photos are publicly readable"
on storage.objects for select
using (bucket_id = 'community-photos');

drop policy if exists "Users can upload own community photos" on storage.objects;
create policy "Users can upload own community photos"
on storage.objects for insert
with check (
  bucket_id = 'community-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own community photos" on storage.objects;
create policy "Users can delete own community photos"
on storage.objects for delete
using (
  bucket_id = 'community-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
