// The brand of a request that has no requester.
//
// 15 Oct 2026. `coach_notifications` being empty since 4 Oct was consistent
// with two very different stories — "the cron never runs" and "it runs and
// decides there is nothing worth saying" — and there was no way to tell them
// apart, because a run that sent nothing left nothing behind.
//
// The Supabase edge logs settled it: `coach_push_state`, the queue read, had
// not been called ONCE in 23 hours against 23 scheduled runs. So the function
// was not deciding anything. It was refusing itself before it read the queue.
//
// This is the most likely reason, and it predates the 14 Oct header fix. A
// scheduled invocation is synthesised by Netlify and carries no Host header,
// and the brand came from the Host header and nothing else — so no host, no
// brand, 400, every hour, silently. Probing it by hand always worked, because
// a hand-made request has a real host. That is why it hid for eleven days.
//
// The fix takes the brand from the SITE on a scheduled run. Each brand has its
// own Netlify site and its own cron, and the site's own identity cannot be
// supplied by a caller — which makes it more trustworthy than the header, not
// less.
import test from 'node:test'
import assert from 'node:assert/strict'
import { brandFromSite } from '../netlify/functions/coach-notify.mjs'

// Set exactly the three variables under test and nothing else. Values only go
// in; nothing here reads or reports the surrounding environment.
function withEnv(vals, fn) {
  const before = {
    BRAND: Object.prototype.hasOwnProperty.call(process.env, 'BRAND') ? process.env.BRAND : null,
    URL: Object.prototype.hasOwnProperty.call(process.env, 'URL') ? process.env.URL : null,
    SITE_NAME: Object.prototype.hasOwnProperty.call(process.env, 'SITE_NAME') ? process.env.SITE_NAME : null,
  }
  const apply = (v) => {
    if (v.BRAND == null) delete process.env.BRAND; else process.env.BRAND = v.BRAND
    if (v.URL == null) delete process.env.URL; else process.env.URL = v.URL
    if (v.SITE_NAME == null) delete process.env.SITE_NAME; else process.env.SITE_NAME = v.SITE_NAME
  }
  apply({ BRAND: null, URL: null, SITE_NAME: null })
  apply(vals)
  try { return fn() } finally { apply(before) }
}

test('the site URL names the brand, because Netlify injects it', () => {
  withEnv({ URL: 'https://rick-fit.netlify.app' }, () => {
    assert.deepEqual(brandFromSite(), { brand: 'ricky', from: 'URL' })
  })
  withEnv({ URL: 'https://coached-by-kim.netlify.app' }, () => {
    assert.deepEqual(brandFromSite(), { brand: 'kim', from: 'URL' })
  })
  // A path and a port must not stop it resolving.
  withEnv({ URL: 'https://elev8-hyrox.netlify.app/' }, () => {
    assert.deepEqual(brandFromSite(), { brand: 'elev8', from: 'URL' })
  })
})

test('BRAND wins when it is set, and is ignored when it is not a brand', () => {
  withEnv({ BRAND: 'paul', URL: 'https://rick-fit.netlify.app' }, () => {
    assert.deepEqual(brandFromSite(), { brand: 'paul', from: 'BRAND' })
  })
  // Validated against the known slugs rather than trusted. A typo in a site's
  // env var must not become a recipient set nobody meant.
  withEnv({ BRAND: 'not-a-brand', URL: 'https://rick-fit.netlify.app' }, () => {
    assert.deepEqual(brandFromSite(), { brand: 'ricky', from: 'URL' })
  })
  withEnv({ BRAND: '  RICKY  ', URL: 'https://coached-by-kim.netlify.app' }, () => {
    assert.deepEqual(brandFromSite(), { brand: 'ricky', from: 'BRAND' },
      'case and whitespace in a hand-typed env var should not decide the answer')
  })
})

test('SITE_NAME is the last resort', () => {
  withEnv({ SITE_NAME: 'elev8-hyrox' }, () => {
    assert.deepEqual(brandFromSite(), { brand: 'elev8', from: 'SITE_NAME' })
  })
  withEnv({ SITE_NAME: 'some-other-site' }, () => {
    assert.deepEqual(brandFromSite(), { brand: null, from: 'none' })
  })
})

test('nothing to go on is null, never a guess', () => {
  // This is the whole hazard the function was built around: the old nudge RPCs
  // returned EVERY brand's clients, so "could not work out the brand" must
  // never degrade into "send to everyone".
  withEnv({}, () => {
    assert.deepEqual(brandFromSite(), { brand: null, from: 'none' })
  })
  // And a junk URL must not throw on the way past, or the hourly run dies with
  // a stack trace instead of a decision.
  withEnv({ URL: 'not a url' }, () => {
    assert.deepEqual(brandFromSite(), { brand: null, from: 'none' })
  })
  withEnv({ URL: '' }, () => {
    assert.deepEqual(brandFromSite(), { brand: null, from: 'none' })
  })
})
