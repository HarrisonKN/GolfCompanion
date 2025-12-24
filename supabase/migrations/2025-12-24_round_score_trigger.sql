-- Compute numeric round score from scorecard JSON
create or replace function public.compute_round_score(scorecard jsonb, preferred_name text default null)
returns integer
language plpgsql
security invoker
as $$
declare
  chosen jsonb;
  player jsonb;
  scores jsonb;
  v jsonb;
  vtext text;
  num int;
  total int := 0;
begin
  if scorecard is null then
    return null;
  end if;

  -- Try to choose player by preferred name
  if preferred_name is not null then
    for player in select elem from jsonb_array_elements(scorecard) elem loop
      if coalesce(player->>'name', player->>'player') = trim(preferred_name) then
        chosen := player;
        exit;
      end if;
    end loop;
  end if;

  -- Fallback to first player
  if chosen is null then
    chosen := (select elem from jsonb_array_elements(scorecard) elem limit 1);
  end if;

  if chosen is null then return null; end if;

  scores := chosen->'scores';
  if scores is null then return null; end if;

  for v in select value from jsonb_array_elements(scores) loop
    vtext := trim(both '"' from v::text);
    begin
      -- Extract leading integer before '/' or any other text
      select coalesce(nullif(substring(vtext from '^[0-9]+'), ''), '0')::int into num;
    exception when others then
      num := 0;
    end;
    total := total + coalesce(num,0);
  end loop;

  return total;
end;
$$;

-- Trigger to auto-fill score on insert/update when missing
create or replace function public.tg_set_round_score()
returns trigger
language plpgsql
security invoker
as $$
begin
  if NEW.score is null and NEW.scorecard is not null then
    NEW.score := public.compute_round_score(NEW.scorecard::jsonb, null);
  end if;
  return NEW;
end;
$$;

drop trigger if exists set_round_score_before on public.golf_rounds;
create trigger set_round_score_before
before insert or update on public.golf_rounds
for each row execute function public.tg_set_round_score();

-- Backfill existing rounds where score is missing but scorecard exists
update public.golf_rounds gr
set score = public.compute_round_score(gr.scorecard::jsonb, null)
where gr.score is null and gr.scorecard is not null;

-- Ensure a RLS policy exists so users can read their own rounds (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'golf_rounds_select_own'
  ) THEN
    CREATE POLICY golf_rounds_select_own ON public.golf_rounds
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Replace stats view to coalesce missing numeric score with computed score
create or replace view public.user_golf_stats with (security_invoker = on) as
select
  gr.user_id,
  count(*)::int as rounds_count,
  avg(coalesce(gr.score, public.compute_round_score(gr.scorecard::jsonb, null)))::numeric(10,2) as avg_score,
  min(coalesce(gr.score, public.compute_round_score(gr.scorecard::jsonb, null)))::int as best_score,
  avg(gr.fairways_hit)::numeric(10,2) as fairways_avg,
  avg(gr.putts)::numeric(10,2) as putts_avg,
  lr.course_name as last_round_course_name,
  lr.date as last_round_date,
  lr.score as last_round_score
from public.golf_rounds gr
left join lateral (
  select r.course_name, r.date,
    coalesce(r.score, public.compute_round_score(r.scorecard::jsonb, null)) as score
  from public.golf_rounds r
  where r.user_id = gr.user_id
  order by r.date desc nulls last
  limit 1
) lr on true
group by gr.user_id, lr.course_name, lr.date, lr.score;

comment on view public.user_golf_stats is 'Aggregated per-user stats from golf_rounds; uses computed score when necessary.';
