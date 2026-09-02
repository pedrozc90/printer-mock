import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    advanceCycle,
    clearForCancel,
    createInitialState,
    enqueueTag,
    getLastPrinted,
    getStatus,
    setPaused,
    type EpcTid,
} from "./state.ts";

const TAG = (n: number): EpcTid => ({ epc: `EPC-${n}`, tid: `TID-${n}` });

describe("advanceCycle", () => {
    it("stays STANDBY while the queue is empty", () => {
        const state = advanceCycle(createInitialState(), Date.now());
        assert.equal(state.phase, "STANDBY");
    });

    it("stays ANALYSING at 249ms", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);
        assert.equal(state.phase, "ANALYSING");

        state = advanceCycle(state, t0 + 249);
        assert.equal(state.phase, "ANALYSING");
    });

    it("transitions to PRINTING at exactly 250ms", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);

        state = advanceCycle(state, t0 + 250);
        assert.equal(state.phase, "PRINTING");
    });

    it("stays PRINTING at 549ms total", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);

        state = advanceCycle(state, t0 + 549);
        assert.equal(state.phase, "PRINTING");
        assert.equal(state.queue.length, 1);
    });

    it("pops the entry and returns to STANDBY at exactly 550ms total", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);

        state = advanceCycle(state, t0 + 550);
        assert.equal(state.phase, "STANDBY");
        assert.equal(state.queue.length, 0);
        assert.deepEqual(state.lastPrinted, TAG(1));
    });

    it("immediately starts the next entry's cycle when the queue still has entries", () => {
        const t0 = 1_000_000;
        let state = createInitialState();
        state = enqueueTag(state, TAG(1), t0);
        state = enqueueTag(state, TAG(2), t0);

        state = advanceCycle(state, t0 + 550);
        assert.equal(state.phase, "ANALYSING");
        assert.equal(state.queue.length, 1);
        assert.deepEqual(state.lastPrinted, TAG(1));
    });

    it("catches up through multiple completed entries in one call, keeping only the last as lastPrinted", () => {
        const t0 = 1_000_000;
        let state = createInitialState();
        state = enqueueTag(state, TAG(1), t0);
        state = enqueueTag(state, TAG(2), t0);
        state = enqueueTag(state, TAG(3), t0);

        state = advanceCycle(state, t0 + 10_000);

        assert.equal(state.phase, "STANDBY");
        assert.equal(state.queue.length, 0);
        assert.deepEqual(state.lastPrinted, TAG(3));
    });
});

describe("setPaused", () => {
    it("freezes elapsed time while paused", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);

        state = advanceCycle(state, t0 + 100);
        state = setPaused(state, true, t0 + 100);
        assert.equal(state.paused, true);

        const frozen = advanceCycle(state, t0 + 5000);
        assert.equal(frozen.phase, "ANALYSING");
        assert.equal(frozen.paused, true);
    });

    it("resumes from the preserved elapsed time, not restarted", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);

        state = advanceCycle(state, t0 + 200); // 200ms into the 250ms ANALYSING phase
        state = setPaused(state, true, t0 + 200);

        const resumeAt = t0 + 999_999;
        state = setPaused(state, false, resumeAt);

        // only 50ms more should be needed to finish ANALYSING (200ms already spent before pausing)
        const stillAnalysing = advanceCycle(state, resumeAt + 49);
        assert.equal(stillAnalysing.phase, "ANALYSING");

        const nowPrinting = advanceCycle(state, resumeAt + 50);
        assert.equal(nowPrinting.phase, "PRINTING");
    });

    it("pausing when already paused is a no-op", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);
        state = setPaused(state, true, t0 + 10);
        const again = setPaused(state, true, t0 + 999);
        assert.deepEqual(again, state);
    });
});

describe("enqueueTag", () => {
    it("forces paused=false and anchors the cycle immediately, not deferred to the next poll", () => {
        const t0 = 1_000_000;
        let state = setPaused(createInitialState(), true, t0);
        state = enqueueTag(state, TAG(1), t0);

        assert.equal(state.paused, false);
        assert.equal(state.phase, "ANALYSING");

        const later = advanceCycle(state, t0 + 400);
        assert.equal(later.phase, "PRINTING");
    });
});

describe("clearForCancel", () => {
    it("clears the queue, last printed, and aborts an in-progress cycle", () => {
        const t0 = 1_000_000;
        let state = createInitialState();
        state = enqueueTag(state, TAG(1), t0);
        state = advanceCycle(state, t0 + 550); // TAG(1) finishes, becomes lastPrinted
        state = enqueueTag(state, TAG(2), t0 + 550);
        state = advanceCycle(state, t0 + 600); // mid-cycle on TAG(2)

        const cleared = clearForCancel(state);

        assert.equal(cleared.queue.length, 0);
        assert.equal(cleared.lastPrinted, null);
        assert.equal(cleared.phase, "STANDBY");
        assert.equal(cleared.paused, false);
    });
});

describe("getStatus / getLastPrinted", () => {
    it("getStatus reports WAITING while paused, without advancing the cycle", () => {
        const t0 = 1_000_000;
        let state = enqueueTag(createInitialState(), TAG(1), t0);
        state = setPaused(state, true, t0 + 10);

        const { snapshot } = getStatus(state, t0 + 99_999);
        assert.equal(snapshot.phase, "WAITING");
    });

    it("getLastPrinted returns null before anything has finished printing", () => {
        const t0 = 1_000_000;
        const state = enqueueTag(createInitialState(), TAG(1), t0);
        const { lastPrinted } = getLastPrinted(state, t0 + 100);
        assert.equal(lastPrinted, null);
    });

    it("getLastPrinted returns the completed tag once its cycle finishes", () => {
        const t0 = 1_000_000;
        const state = enqueueTag(createInitialState(), TAG(1), t0);
        const { lastPrinted } = getLastPrinted(state, t0 + 550);
        assert.deepEqual(lastPrinted, TAG(1));
    });
});
