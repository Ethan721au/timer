type Listener = (elapsed: number) => void;

export enum TimerType {
  TIMER = "timer",
  STOPWATCH = "stopwatch",
}

interface Timer {
  startTs: number;
  elapsedTime: number;
  intervalId: ReturnType<typeof setInterval> | null;
  listeners: Set<Listener>;
  type: TimerType;
  initialDuration?: number;
}

const timers = new Map<string, Timer>();

export const TimerManager = {
  /** Create (or noop if already exists) */
  createStopWatch(id: string, currentElapsedMs: number = 0) {
    if (!timers.has(id)) {
      timers.set(id, {
        startTs: 0,
        elapsedTime: currentElapsedMs,
        intervalId: null,
        listeners: new Set(),
        type: TimerType.STOPWATCH,
      });
    }
  },

  createTimer(id: string, durationMs: number) {
    if (!timers.has(id)) {
      timers.set(id, {
        startTs: 0,
        elapsedTime: 0,
        intervalId: null,
        listeners: new Set(),
        type: TimerType.TIMER,
        initialDuration: durationMs,
      });
    }
  },

  /** Start or resume the timer */
  start(id: string) {
    const timer = timers.get(id);
    if (!timer) throw new Error(`Timer "${id}" not found`);
    if (timer.intervalId !== null) return; // already running

    timer.startTs = Date.now();

    const initialValue = this._computeValue(timer);
    timer.listeners.forEach((fn) => fn(initialValue));

    timer.intervalId = setInterval(() => {
      const value = this._computeValue(timer);

      // if we're down-ticking and hit zero, auto-clear:
      if (timer.type === TimerType.TIMER && value <= 0) {
        timer.listeners.forEach((fn) => fn(0));
        this.clear(id);
        return;
      }

      timer.listeners.forEach((fn) => fn(value));
    }, 1000);
  },

  /** Pause (stop ticking, but keep the progress so you can resume) */
  stop(id: string) {
    const timer = timers.get(id);
    if (timer?.intervalId != null) {
      const delta = Date.now() - timer.startTs;
      timer.elapsedTime += delta;
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
  },

  /** Completely remove this timer (listeners + state). */
  clear(id: string) {
    this.stop(id);
    timers.delete(id);
  },

  /**
   * Subscribe a callback to run every tick.
   * Returns an unsubscribe function.
   */
  subscribe(id: string, fn: Listener): () => void {
    const timer = timers.get(id);
    if (!timer) throw new Error(`Timer "${id}" not found`);
    timer.listeners.add(fn);
    return () => {
      timer.listeners.delete(fn);
    };
  },

  /**
   * Helper to compute “current” value from a Timer object
   * - up: elapsed = elapsedTime + (now – startTs)
   * - down: remaining = initialDuration – (elapsedTime + (now – startTs))
   */
  _computeValue(timer: Timer): number {
    const sinceStart =
      timer.intervalId != null ? Date.now() - timer.startTs : 0;
    const total = timer.elapsedTime + sinceStart;

    if (timer.type === TimerType.STOPWATCH) {
      return total;
    } else {
      // down
      const remaining = (timer.initialDuration ?? 0) - total;
      return remaining > 0 ? remaining : 0;
    }
  },

  /** (Optional) read the current value on-demand */
  getValue(id: string): number {
    const timer = timers.get(id);
    if (!timer) throw new Error(`Timer "${id}" not found`);
    return this._computeValue(timer);
  },
};
