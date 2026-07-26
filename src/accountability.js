// Accountability "bot" — Kim-voice nudges at five intensity levels.
// Level 1 is the softest, no-pressure whisper; level 5 is full tough-love —
// firm and pushy, but always on the client's side, never shaming or unkind.

export const LEVELS = [
  { n: 1, label: 'Gentle', blurb: 'A soft, no-pressure whisper.' },
  { n: 2, label: 'Friendly', blurb: 'A warm little reminder.' },
  { n: 3, label: 'Encouraging', blurb: 'A proper nudge to keep your momentum.' },
  { n: 4, label: 'Firm', blurb: 'No skipping — and I mean it.' },
  { n: 5, label: 'Tough love', blurb: 'Full accountability, no excuses (still on your side).' },
]

export const FOOD_NUDGES = {
  1: [
    'Whenever you’re ready, it’d be lovely to see what you had for breakfast.',
    'No rush at all — pop your next meal in when you get a moment.',
    'If it suits you, logging your food helps me help you.',
  ],
  2: [
    'Morning! Don’t forget to log your breakfast when you get a sec.',
    'Quick reminder — snap your meals in today so we stay on track.',
    'Have you logged what you’ve eaten so far? Whenever works for you.',
  ],
  3: [
    'Come on then — what’s for breakfast? Snap it and log it, let’s keep the momentum.',
    'Let’s stay on it — get your meals logged, you’re doing so well.',
    'Don’t leave me guessing — show me what’s on your plate today!',
  ],
  4: [
    'Right, no skipping. What are you having for breakfast? Log it now — you’ll thank yourself.',
    'We agreed you’d track your food. Get it logged, please — it really matters.',
    'Come on, no drifting today. Every meal goes in. You’ve got this.',
  ],
  5: [
    'Oi — you promised YOURSELF this. Breakfast logged, no excuses. Show me. Let’s go.',
    'Stop putting it off. What are you eating? Log it, right now. I’m not letting you off today.',
    'No hiding today. Every meal goes in. You didn’t come this far to coast — GO.',
  ],
}

export const WORKOUT_NUDGES = {
  1: [
    'If you fancy it, a little movement today would feel really good.',
    'No pressure — but your body loves a session when you’re ready.',
    'Whenever it suits, even a short workout counts.',
  ],
  2: [
    'Did you get your workout in? Log it when you do.',
    'Friendly nudge — a session today would keep things ticking over.',
    'Don’t forget to move today, and pop it in when you’re done.',
  ],
  3: [
    'Come on, let’s get that workout done today — you’ll feel great after.',
    'Momentum time — get your session in, I know you can.',
    'Let’s not skip today. Get moving and log it, you’ll be so glad you did.',
  ],
  4: [
    'You said you’d train today. Time to lace up — get it done and log it.',
    'No excuses now — your workout’s waiting. Go and earn that good feeling.',
    'We had a deal. Session done today, please. Show up for yourself.',
  ],
  5: [
    'No backing out. You promised yourself a workout. Stop scrolling, go train, and log it. NOW.',
    'You’re better than “maybe tomorrow”. Get up, get it done, no excuses. GO.',
    'This is the moment you don’t quit. Train today. Log it. Prove it to yourself.',
  ],
}

// A stable day-of-year index so the message varies daily but not on every render.
export function daySeed(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d - start) / 86400000)
}

export function pickNudge(bank, level, seed) {
  const arr = bank[level] || bank[2]
  return arr[((seed % arr.length) + arr.length) % arr.length]
}
