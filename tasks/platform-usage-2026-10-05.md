# Who is actually using the apps — 5 October 2026

Ricky asked: "is anyone else using their apps that we have built for them, or
just Paul?"

**Answer: Paul, and Ricky. Nothing else has a live user.**

Measured against the shared Supabase (`ezwmfbuuopsnpanebtal`) on 4–5 Oct 2026.
Usage means sign-ins and logged activity, not accounts created.

## The table

| Brand / coach | Coach last in | Clients signed in, 30d | Food logs, 7d | Workouts, 30d | Verdict |
|---|---|---|---|---|---|
| **Paul Andrews — ReDefine** | 4 Oct | **11** | **257** | **61** | Live, daily |
| **Rick.Fit — Ricky** | (uses client login) | 1 | 10 | 19 | Live, his own training |
| Kim Roffe — Coached by Kim | 13 Aug | 0 | 0 | 0 | Dormant |
| Sam — PPH | 30 Jul | 0 | 0 | 0 | Dormant |
| Jordan — PPH | 30 Jul | 0 | 0 | 0 | Dormant |
| Paul (Elev8u) | 12 Sep | 0 | 0 | 0 | Dormant |
| Selina (Elev8u) | 12 Sep | 0 | 0 | 0 | Dormant |
| Elev8 Coach (original demo) | 31 Jul | 0 | 0 | 0 | Dormant |
| Lekan | 29 Jul | 0 | 0 | 0 | Seed data, not a customer |
| BBL Gym | 17 Jul | 0 | 0 | 0 | No clients, ever |
| Kym Test | 12 Sep | 0 | 0 | 0 | Test account |
| Kelsey Fit / Lennon GK | — | 2 / 1 | 0 | 0 | Ricky's own brands |

## Three things the raw numbers would mislead you about

**The Elev8u sign-ins on 12 September are mine, not theirs.** That is the day the
Elev8 demo was rebuilt and smoke-tested. Paul and Selina have not opened it. The
demo message written for them (`tasks/elev8-demo-message.md`) has still not been
sent, so they have never seen the fix to the broken athlete login that was
turning them away from 3 August onwards.

**"Lekan" is not a customer.** Eight linked clients, which makes it the
second-largest roster in the database. All eight are `@bbl.app` addresses with
join dates staggered across a year, none onboarded, one sign-in between them. It
is a fabricated roster for the BBL gym demo.

**Rick.Fit's coach account has never signed in.** The activity is Ricky using the
client side. Real use, but it is his own training, not a customer.

## What it means

- **One paying customer carries the entire platform.** Paul's roster grew 9 → 14
  billable clients between the September and October invoices.
- **Kim is the one worth asking about.** The product was designed around her as
  the live design partner; she has one client, who last signed in on 16 July.
  Whatever stopped her is the most useful thing in this table, because she is the
  only coach who ever used it and then stopped.
- **PPH went quiet in launch week** — 30 July, and nothing since.
- Elev8u are not a lost cause so much as an unsent message.

## Re-running this

```sql
-- Live usage per coach: sign-ins and logged activity, test/paused excluded.
with cl as (
  select p.trainer_id as coach, p.id as client
  from public.profiles p
  where p.role <> 'trainer' and p.trainer_id is not null
    and coalesce(p.is_test, false) = false
    and coalesce(p.status, 'active') = 'active'
)
select pr.full_name as coach,
  u.last_sign_in_at::date as coach_last_signin,
  (select count(*) from cl where cl.coach = pr.id) as clients,
  (select count(*) from public.profiles c join auth.users cu on cu.id = c.id
     where c.trainer_id = pr.id and cu.last_sign_in_at > now() - interval '30 days') as signed_in_30d,
  (select count(*) from public.nutrition_logs n
     where n.client_id in (select client from cl where cl.coach = pr.id)
       and n.logged_at > now() - interval '7 days') as food_logs_7d,
  (select count(*) from public.workout_completions w
     where w.client_id in (select client from cl where cl.coach = pr.id)
       and w.completed_on > current_date - 30) as workouts_30d
from public.profiles pr join auth.users u on u.id = pr.id
where pr.role = 'trainer'
order by signed_in_30d desc, coach_last_signin desc nulls last;
```

Run it through the claude.ai Supabase MCP (`execute_sql`, project
`ezwmfbuuopsnpanebtal`) — it needs to cross tenants, so it must bypass RLS.

**Caveat worth keeping:** sign-ins and logs measure the CLIENT app well and the
coach app badly. A coach who reads the dashboard and never types leaves almost no
trace beyond `last_sign_in_at`. Nobody here is a false negative on that count —
the dormant coaches have not signed in for months — but do not read "0 food logs"
as "not using it" for a coach in future.
