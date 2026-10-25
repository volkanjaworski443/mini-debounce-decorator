/**
 * Creates a debounced version of `fn` that delays execution until `wait`
 * milliseconds have elapsed since the last invocation.
 *
 * Design decisions:
 *
 * - A clock function (`now`) is injectable so that tests are deterministic.
 *   Defaulting to `Date.now` keeps the call site simple for real usage.
 *
 * - The timer delay is computed as `wait - (now() - lastCallTime)` on every
 *   call instead of always scheduling `wait` milliseconds ahead. This keeps
 *   the pending firing time anchored to the trailing edge of the call burst,
 *   which is the standard debounce semantic and matches lodash's behaviour.
 *
 * - `setTimeout` and `clearTimeout` are injected as well so tests never touch
 *   the real event loop. The timer callback is responsible for firing when the
 *   fake clock advances, which keeps behaviour identical between production
 *   and tests.
 *
 * - If `wait` is 0 or negative we invoke synchronously on the next tick via
 *   a zero-delay timer rather than calling `fn` inline. This preserves a
 *   consistent (always-async) execution model and avoids surprising callers
 *   who rely on the callback not running during the call that scheduled it.
 *
 * - The debounced function does not forward a return value, because the real
 *   invocation happens later. Returning `undefined` keeps the contract honest.
 *
 * - `cancel()` clears the pending timer and resets the saved arguments so a
 *   subsequent call starts fresh. There is no `flush()` — this library is
 *   deliberately small and only covers the trailing-edge case.
 *
 * @param {Function} fn - Function to debounce.
 * @param {number} wait - Milliseconds to wait after the last call.
 * @param {{ now?: () => number, setTimeout?: typeof setTimeout, clearTimeout?: typeof clearTimeout }} [options]
 * @returns {{ (...args: any[]) => void, cancel: () => void }}
 */
export function debounce(fn, wait, options = {}) {
  const now = options.now ?? Date.now;
  const setTimeoutRef = options.setTimeout ?? setTimeout;
  const clearTimeoutRef = options.clearTimeout ?? clearTimeout;

  let timerId = null;
  let lastArgs = null;
  let lastCallTime = null;

  function invoke() {
    timerId = null;
    const args = lastArgs;
    lastArgs = null;
    if (args !== null) {
      fn(...args);
    }
  }

  function schedule(remaining) {
    if (timerId !== null) {
      clearTimeoutRef(timerId);
    }
    timerId = setTimeoutRef(invoke, remaining);
  }

  const debounced = (...args) => {
    lastArgs = args;
    const callTime = now();
    lastCallTime = callTime;

    if (timerId === null) {
      schedule(wait);
    } else {
      const elapsed = callTime - lastCallTime;
      const remaining = Math.max(0, wait - elapsed);
      schedule(remaining);
    }
  };

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeoutRef(timerId);
      timerId = null;
    }
    lastArgs = null;
    lastCallTime = null;
  };

  return debounced;
}
