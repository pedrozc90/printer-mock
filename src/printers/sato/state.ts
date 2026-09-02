export interface EpcTid {
    epc: string;
    tid: string;
}

export type CyclePhase = "STANDBY" | "ANALYSING" | "PRINTING";

export interface StatusSnapshot {
    phase: CyclePhase | "WAITING";
    queueLength: number;
}

export interface PrinterState {
    queue: EpcTid[];
    lastPrinted: EpcTid | null;
    paused: boolean;
    phase: CyclePhase;
    // Invariant: while `phaseAnchor` is set, it is the timestamp such that
    // `now - phaseAnchor` is the true elapsed time in the current phase (phaseElapsedMs is
    // stale/unused in that state). While paused (`phaseAnchor === null`), `phaseElapsedMs` holds
    // the committed/frozen elapsed time instead. This lets pausing "freeze the clock" without a
    // background timer: nothing updates while paused, and resuming just re-derives a fresh anchor
    // from the frozen value.
    phaseElapsedMs: number;
    phaseAnchor: number | null;
}

export const ANALYSING_MS = 250;
export const PRINTING_MS = 300;

export const createInitialState = (): PrinterState => ({
    queue: [],
    lastPrinted: null,
    paused: false,
    phase: "STANDBY",
    phaseElapsedMs: 0,
    phaseAnchor: null,
});

const elapsedInPhase = (state: PrinterState, now: number): number =>
    state.phaseAnchor === null ? state.phaseElapsedMs : now - state.phaseAnchor;

const freeze = (state: PrinterState, now: number): PrinterState => ({
    ...state,
    phaseElapsedMs: elapsedInPhase(state, now),
    phaseAnchor: null,
});

const reanchor = (state: PrinterState, now: number): PrinterState =>
    state.phase === "STANDBY" ? { ...state, phaseAnchor: null } : { ...state, phaseAnchor: now - state.phaseElapsedMs };

/**
 * Advances the printer through however many phases (and completed tags) should have elapsed by
 * `now`, given the current state. Runs independent of DC2+PK polling — a single call can pop
 * multiple entries if enough time has passed since the last time state was touched; only the
 * last one popped survives as `lastPrinted` (matches real-hardware behavior: infrequent polling
 * can miss intermediate results).
 */
export const advanceCycle = (state: PrinterState, now: number): PrinterState => {
    if (state.paused) return state;

    let phase = state.phase;
    let queue = state.queue;
    let lastPrinted = state.lastPrinted;
    let elapsed = elapsedInPhase(state, now);

    if (phase === "STANDBY") {
        if (queue.length === 0) return state;
        phase = "ANALYSING";
        elapsed = 0;
    }

    for (;;) {
        const duration = phase === "ANALYSING" ? ANALYSING_MS : PRINTING_MS;
        if (elapsed < duration) break;
        elapsed -= duration;

        if (phase === "ANALYSING") {
            phase = "PRINTING";
            continue;
        }

        // PRINTING just completed: pop the front entry and move on to the next, if any.
        const [printed, ...rest] = queue;
        queue = rest;
        lastPrinted = printed ?? lastPrinted;
        phase = queue.length > 0 ? "ANALYSING" : "STANDBY";
        if (phase === "STANDBY") break;
    }

    if (phase === "STANDBY") {
        return { queue, lastPrinted, paused: state.paused, phase, phaseElapsedMs: 0, phaseAnchor: null };
    }
    return { queue, lastPrinted, paused: state.paused, phase, phaseElapsedMs: elapsed, phaseAnchor: now - elapsed };
};

export const setPaused = (state: PrinterState, paused: boolean, now: number): PrinterState => {
    if (paused) {
        if (state.paused) return state;
        return { ...freeze(state, now), paused: true };
    }
    if (!state.paused) return advanceCycle(state, now);

    const resumed = reanchor({ ...freeze(state, now), paused: false }, now);
    return advanceCycle(resumed, now);
};

/** Enqueues a tag, forces `paused = false` (see mock-behavior.md's SBPL block rules), and lets
 * the cycle bootstrap/catch up immediately rather than waiting for the next poll. */
export const enqueueTag = (state: PrinterState, tag: EpcTid, now: number): PrinterState => {
    const committed = freeze(state, now);
    const withTag: PrinterState = { ...committed, queue: [...committed.queue, tag], paused: false };
    const resumed = reanchor(withTag, now);
    return advanceCycle(resumed, now);
};

/** DC2+PH: clears the buffer, the last-printed register, and any in-progress cycle. */
export const clearForCancel = (_state: PrinterState): PrinterState => createInitialState();

export const getStatus = (state: PrinterState, now: number): { state: PrinterState; snapshot: StatusSnapshot } => {
    if (state.paused) {
        return { state, snapshot: { phase: "WAITING", queueLength: state.queue.length } };
    }
    const next = advanceCycle(state, now);
    return { state: next, snapshot: { phase: next.phase, queueLength: next.queue.length } };
};

export const getLastPrinted = (state: PrinterState, now: number): { state: PrinterState; lastPrinted: EpcTid | null } => {
    const next = state.paused ? state : advanceCycle(state, now);
    return { state: next, lastPrinted: next.lastPrinted };
};
