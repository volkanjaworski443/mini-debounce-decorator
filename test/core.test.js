import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from '../src/index.js';

// Fake clock that supports `now()` and lets tests advance time explicitly.
// `tick()` fires any scheduled callback whose due time has arrived, in order.
function createClock() {
  let currentTime = 1000;
  let nextId = 1;
  const timers = new Map();

  return {
    now() { return currentTime; },
    tick(ms) {
      const target = currentTime + ms;
      // Iterate until no timer fires before `target`.
      for (;;) {
        const due = [...timers.values()].filter(t => t.fireAt <= target);
        if (due.length === 0) break;
        due.sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);
        const next = due[0];
        currentTime = next.fireAt;
        timers.delete(next.id);
        next.callback();
      }
      currentTime = target;
    },
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { id, fireAt: currentTime + ms, callback });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    get pendingCount() { return timers.size; },
  };
}

test('single invocation fires after wait', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, 100, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d();
  assert.equal(calls, 0);
  clock.tick(50);
  assert.equal(calls, 0);
  clock.tick(50);
  assert.equal(calls, 1);
});

test('rapid calls delay execution until the burst settles', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, 100, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d();
  clock.tick(40);
  d();
  clock.tick(40);
  d();
  assert.equal(calls, 0);
  assert.equal(clock.pendingCount, 1);
  clock.tick(99);
  assert.equal(calls, 0);
  clock.tick(1);
  assert.equal(calls, 1);
});

test('only the latest arguments are used', () => {
  const clock = createClock();
  const received = [];
  const d = debounce((x) => { received.push(x); }, 50, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d(1);
  d(2);
  d(3);
  clock.tick(50);
  assert.deepEqual(received, [3]);
});

test('cancel prevents a pending invocation', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, 100, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d();
  d.cancel();
  assert.equal(clock.pendingCount, 0);
  clock.tick(200);
  assert.equal(calls, 0);
});

test('cancel then call again works fresh', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, 50, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d();
  d.cancel();
  d();
  clock.tick(50);
  assert.equal(calls, 1);
});

test('multiple calls produce exactly one firing', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, 30, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  for (let i = 0; i < 5; i++) {
    d();
    clock.tick(10);
  }
  assert.equal(calls, 0);
  clock.tick(30);
  assert.equal(calls, 1);
});

test('debounced function returns undefined', () => {
  const clock = createClock();
  const d = debounce(() => 42, 10, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  assert.equal(d(), undefined);
});

test('zero wait schedules via timer, not inline', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, 0, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d();
  assert.equal(calls, 0);
  assert.equal(clock.pendingCount, 1);
  clock.tick(0);
  assert.equal(calls, 1);
});

test('negative wait behaves like zero wait', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, -50, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d();
  assert.equal(calls, 0);
  clock.tick(0);
  assert.equal(calls, 1);
});

test('default options use real Date.now and setTimeout', () => {
  // Smoke test: ensure the function is callable with no options object.
  // We do not assert timing here — only that the call does not throw and
  // cancel is available without errors.
  const d = debounce(() => {}, 10);
  assert.equal(typeof d, 'function');
  assert.equal(typeof d.cancel, 'function');
  d.cancel();
});

test('back-to-back bursts each fire once', () => {
  const clock = createClock();
  let calls = 0;
  const d = debounce(() => { calls++; }, 40, { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

  d();
  clock.tick(40);
  assert.equal(calls, 1);
  d();
  clock.tick(40);
  assert.equal(calls, 2);
});
