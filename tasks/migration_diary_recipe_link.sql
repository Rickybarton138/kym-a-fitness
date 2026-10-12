-- Paul, 12 Oct: "If someone has pretracked a recipe in advance ... but when that
-- day rolls around they make some adjustments to the recipe; Can we have an
-- 'edit' button in the food diary for editing recipes."
--
-- A diary entry logged from a recipe has never carried any link back to it: the
-- row is a flat snapshot of a name and five numbers. So there was nothing to
-- re-read when the recipe changed, and nothing to re-portion.
--
-- ON DELETE SET NULL, not CASCADE. Deleting a recipe (also his ask today) must
-- never take a month of diary history with it - the entry stays, it just stops
-- offering to refresh itself.
alter table public.nutrition_logs
  add column if not exists recipe_id uuid references public.recipes(id) on delete set null,
  add column if not exists portions numeric;

-- RLS restricts ROWS, not COLUMNS. nutrition_logs carries an explicit
-- column-level allow-list for `authenticated`, so a new column is invisible to
-- the client - and an insert naming it fails - until it is granted here. This
-- is the same trap the GLP-1 columns hit on 10 Oct.
grant select (recipe_id, portions),
      insert (recipe_id, portions),
      update (recipe_id, portions)
  on public.nutrition_logs to authenticated;

create index if not exists nutrition_logs_recipe_idx on public.nutrition_logs (recipe_id) where recipe_id is not null;

-- Backfill, run once on 12 Oct: 66 rows across 5 clients. Entries logged before
-- the column existed are matched by exact title (after stripping a trailing
-- "(N servings)"), and only where that title identifies exactly ONE recipe the
-- client can see. An ambiguous title is left unlinked rather than linked to a
-- guess. No macros are rewritten - this only makes the Edit button offer to
-- re-cost those entries, which is what makes Paul's already-pretracked days
-- benefit from the feature at all.
--
-- with norm as (
--   select l.id, l.client_id,
--          trim(regexp_replace(l.name, '\s*\(\d+(\.\d+)?\s*servings?\)$', '')) base,
--          coalesce(nullif((regexp_match(l.name, '\((\d+(?:\.\d+)?)\s*servings?\)$'))[1], '')::numeric, 1) n
--   from public.nutrition_logs l where l.recipe_id is null and l.name is not null
-- ), uniq as (
--   select n.id, n.n, (array_agg(r.id))[1] rid from norm n
--   join public.recipes r on r.title = n.base
--    and (r.client_id = n.client_id or r.coach_id = (select trainer_id from public.profiles p where p.id = n.client_id))
--   group by n.id, n.n having count(*) = 1
-- )
-- update public.nutrition_logs l set recipe_id = u.rid, portions = u.n from uniq u where l.id = u.id;
