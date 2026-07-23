// Evidence-based sports-nutrition knowledge base powering PPH's "Nutrition Expert".
// Written from the consensus literature — ISSN position stands, the IOC 2018
// supplements consensus, and the Academy of Nutrition & Dietetics / Dietitians of
// Canada / ACSM joint position "Nutrition and Athletic Performance" — organised
// around the IOC Diploma in Sports Nutrition curriculum. Numbers are guideline
// figures; individual needs vary and always sit under a qualified practitioner.

export const NUTRITION_KB = [
  {
    id: 'energy', area: 'Energy & body composition', source: 'ACSM/AND/DC 2016; IOC RED-S',
    title: 'Energy availability underpins everything',
    content:
      'Fuel the work required. Energy availability (energy intake minus exercise energy expenditure, relative to fat-free mass) must be adequate before macros or timing matter. Chronically low energy availability (below roughly 30 kcal/kg fat-free mass/day) drives Relative Energy Deficiency in Sport (RED-S): impaired performance, hormonal and menstrual disruption, reduced bone health, poor recovery and higher injury/illness risk. Match intake to the training load of the day rather than eating the same every day.',
  },
  {
    id: 'protein', area: 'Protein & muscle', source: 'ISSN 2017',
    title: 'Protein: 1.4–2.0 g/kg/day, spread through the day',
    content:
      'A daily intake of about 1.4–2.0 g protein per kg bodyweight supports muscle building and maintenance for most athletes; higher (up to ~2.2–3.0 g/kg) can help when in a calorie deficit or during heavy training to protect lean mass. Aim for roughly 0.25–0.4 g/kg (about 20–40 g) of high-quality protein per meal, containing ~700–3000 mg leucine, every 3–4 hours across the day, including a serving near training and before sleep. Whole foods first; whey/soy/blends are convenient options.',
  },
  {
    id: 'carbs', area: 'Carbohydrate for training', source: 'ACSM/AND/DC 2016',
    title: 'Carbohydrate: periodise to the training load',
    content:
      'Carbohydrate is the priority fuel for moderate-to-high intensity. Daily targets scale with load: ~3–5 g/kg on light/rest days, ~5–7 g/kg for about 1 hour of moderate training, ~6–10 g/kg for 1–3 hours of moderate-to-high training, and ~8–12 g/kg for extreme loads (long/heavy days, tournaments). Fill glycogen ahead of key sessions and matches; ease back on easy days. "Train-low" strategies exist but are advanced and should be periodised carefully.',
  },
  {
    id: 'fuelling', area: 'Competition fuelling', source: 'ACSM/AND/DC 2016',
    title: 'Fuelling around competition',
    content:
      'Pre-event: 1–4 g/kg carbohydrate in the 1–4 hours before, choosing familiar, lower-fibre/lower-fat foods to settle the gut. During exercise: for 45–75 min a carbohydrate mouth-rinse or small amounts help; for 1–2.5 hours aim ~30–60 g carbohydrate/hour; beyond ~2.5–3 hours up to ~90 g/hour using multiple transportable carbohydrates (glucose + fructose, e.g. 2:1) to raise absorption. The gut is trainable — rehearse race fuelling in training. Recovery: carbohydrate plus ~20–40 g protein when the next session is soon.',
  },
  {
    id: 'hydration', area: 'Hydration & electrolytes', source: 'ACSM/AND/DC 2016',
    title: 'Hydration: drink to a plan, replace sodium when sweat losses are high',
    content:
      'Start sessions well hydrated (pale-yellow urine). Aim to limit body-mass loss to under ~2% during exercise, but avoid over-drinking (hyponatraemia risk). Estimate individual sweat rate by weighing before/after training. In long, hot, or salty-sweat situations, include sodium (~300–600 mg/L, sometimes more) to aid fluid retention and reduce cramp risk. After exercise, replace ~125–150% of the fluid deficit over the following hours with sodium-containing drinks/food.',
  },
  {
    id: 'timing', area: 'Nutrient timing & recovery', source: 'ISSN nutrient timing',
    title: 'Recovery: refuel, rebuild, rehydrate',
    content:
      'The old narrow "anabolic window" is overstated, but recovery still matters when sessions are close together (twice-a-day, tournaments). After hard training: carbohydrate to restock glycogen (~1–1.2 g/kg/hour for the first few hours if turnaround is short), ~20–40 g quality protein to stimulate muscle repair, and fluids/sodium to rehydrate. With a full day between sessions, simply hitting daily totals from balanced meals is enough.',
  },
  {
    id: 'fat', area: 'Fat & overall diet', source: 'ACSM/AND/DC 2016',
    title: 'Fat and food quality',
    content:
      'Fat supports hormone production, fat-soluble vitamins and satiety; keep it at roughly 20–35% of energy and do not drop it too low. Prioritise unsaturated sources (oily fish, nuts, seeds, olive oil) and include omega-3s. Build meals around whole foods — plenty of vegetables and fruit, quality protein, wholegrains, dairy or alternatives — so micronutrient needs are met from food first. Very low-carb/ketogenic diets can impair high-intensity performance and are rarely optimal for team/power sports.',
  },
  {
    id: 'supplements', area: 'Supplements & ergogenic aids', source: 'IOC 2018 consensus',
    title: 'Supplements with strong evidence (use food first)',
    content:
      'The IOC 2018 consensus identifies a short list with good evidence for performance in the right context: caffeine (~3–6 mg/kg ~60 min pre for endurance, sprint and skill/vigilance), creatine monohydrate (3–5 g/day; optional ~20 g/day loading for 5–7 days — power, strength, repeated sprints, lean mass), beta-alanine (~3–6 g/day for 4+ weeks — buffering for 1–4 min efforts), dietary nitrate/beetroot (~60–90 min pre — oxygen efficiency), and sodium bicarbonate (high-intensity buffering, gut side-effects to manage). Correct iron/vitamin D deficiency when tests confirm it. Responses vary between individuals; trial everything in training, never first in competition.',
  },
  {
    id: 'antidoping', area: 'Supplements & safety', source: 'IOC 2018; WADA',
    title: 'Supplement safety and contamination',
    content:
      'Supplements are not risk-free: contamination with banned substances is a real cause of positive anti-doping tests, and "proprietary blends" hide doses. Under strict liability, the athlete is responsible for anything in their body. Only use products batch-tested by a credible programme (e.g. Informed Sport), keep the need genuine, and check nothing interacts with medications or medical conditions. Food and a solid daily diet outrank almost any pill.',
  },
  {
    id: 'micronutrients', area: 'Micronutrients & health', source: 'ACSM/AND/DC 2016',
    title: 'Iron, vitamin D and calcium deserve attention',
    content:
      'Athletes at higher risk of deficiency should be screened and treated, not blanket-supplemented. Iron matters for oxygen transport — endurance athletes, menstruating and growing athletes, and plant-based eaters are most at risk; low ferritin hurts performance. Vitamin D supports bone and muscle (deficiency is common in low-sunlight climates like the UK). Calcium and vitamin D together protect bone, especially with low energy availability. Correct deficiencies with guidance and retest.',
  },
  {
    id: 'female', area: 'The female athlete', source: 'IOC RED-S/female athlete',
    title: 'The female athlete: energy, iron, bone',
    content:
      'Female athletes are at particular risk of low energy availability and its knock-on effects on the menstrual cycle and bone health (the Female Athlete Triad / RED-S). A regular menstrual cycle is a useful health signal; loss of periods is a red flag warranting professional review. Iron needs attention due to menstrual losses. Fuelling should track training and, where relevant, be considered across cycle phases. Never pursue aggressive leanness at the expense of energy availability.',
  },
  {
    id: 'youth', area: 'Youth & growth', source: 'IOC youth athlete',
    title: 'Young athletes: fuel growth first',
    content:
      'Children and adolescents are still growing and maturing, so total energy and nutrient adequacy for growth and health comes before any performance tweak. Emphasise regular balanced meals and snacks, adequate calcium and vitamin D for bone development, iron (especially around growth spurts and for girls once menstruating), and good hydration habits. Avoid restrictive dieting, body-composition pressure and most performance supplements in youth — build lifelong food skills instead.',
  },
  {
    id: 'bodycomp', area: 'Changing body composition', source: 'ISSN diets & body comp',
    title: 'Changing body composition without wrecking performance',
    content:
      'To lose fat while protecting muscle and performance: a modest deficit (~300–500 kcal/day, rarely more than ~0.5–1% bodyweight/week), keep protein high (~1.8–2.7 g/kg), maintain resistance training, and time most carbohydrate around key sessions. To gain lean mass: a small surplus (~10–15%), progressive resistance training, and protein spread across the day. Rapid weight-making (e.g. combat sports) carries health and performance risks and should be minimal and professionally supervised.',
  },
]

export const NUTRITION_AREAS = [...new Set(NUTRITION_KB.map((k) => k.area))]

// Compact KB string for the AI system prompt.
export function kbForPrompt() {
  return NUTRITION_KB.map((k) => `[${k.area}] ${k.title}: ${k.content} (evidence: ${k.source})`).join('\n\n')
}
