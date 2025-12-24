-- Aggregated user golf stats view
create or replace view public.user_golf_stats with (security_invoker = on) as
select
  gr.user_id,
  count(*)::int as rounds_count,
  avg(gr.score)::numeric(10,2) as avg_score,
  min(gr.score)::int as best_score,
  avg(gr.fairways_hit)::numeric(10,2) as fairways_avg,
  avg(gr.putts)::numeric(10,2) as putts_avg,
  lr.course_name as last_round_course_name,
  lr.date as last_round_date,
  lr.score as last_round_score
from public.golf_rounds gr
join lateral (
  select r.course_name, r.date, r.score
  from public.golf_rounds r
  where r.user_id = gr.user_id
  order by r.date desc nulls last
  limit 1
) lr on true
group by gr.user_id, lr.course_name, lr.date, lr.score;

comment on view public.user_golf_stats is 'Aggregated per-user stats computed from golf_rounds with security invoker';
