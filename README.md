# mini-debounce-decorator

A tiny debounce utility that delays a function's execution until a configured interval has elapsed since the last call, injecting its own clock and timers so behaviour is fully deterministic in tests.

## Usage

```js
import { debounce } from 'mini-debounce-decorator';

const onResize = debounce(() => {
  console.log('resized');
}, 200);

onResize();

// Later, if you need to cancel a pending call:
onResize.cancel();
```

The debounced function accepts the same arguments as the wrapped function but returns `undefined` — the real call happens later.

## Why

Most debounce libraries hard-code `setTimeout` and `Date.now`, which forces tests to either touch the real event loop or monkey-patch globals. This library takes `now`, `setTimeout`, and `clearTimeout` as an optional options object so tests can pass a fake clock and stay deterministic. The trade-off is a slightly longer call site when you need the injection, but the default (`Date.now` / native `setTimeout`) keeps normal usage one argument shorter.

Only the trailing-edge semantic is implemented: the function fires once, after calls settle down. There is no leading-edge fire, no `flush()`, and no `pending()` predicate. If you need those, pick a bigger library.

## Edge cases

- A `wait` of `0` or a negative number schedules via a zero-delay timer rather than calling synchronously. The wrapped function never runs during the call that scheduled it.
- If `wait` is `0`, repeated calls in the same tick collapse to a single firing on the next tick.
- `cancel()` clears the pending timer and discards any saved arguments, so a subsequent call starts fresh.
