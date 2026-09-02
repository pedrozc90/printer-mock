import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildFrame } from "../../utils/index.ts";
import { buildEpcReply, buildStatusReply } from "./reply.ts";
import type { StatusSnapshot } from "./state.ts";

describe("buildStatusReply", () => {
    it("matches the documented STANDBY/empty-buffer example byte-for-byte", () => {
        const snapshot: StatusSnapshot = { phase: "STANDBY", queueLength: 0 };
        assert.equal(buildStatusReply(snapshot), buildFrame("32,PS0,RS0,RE0,PE0,EN00,BT0,Q000000"));
    });
});

describe("buildEpcReply", () => {
    it("matches the documented empty/no-result example byte-for-byte", () => {
        assert.equal(buildEpcReply(null), buildFrame("13,0,A,EP:,ID:\r\n"));
    });

    it("matches the documented populated example byte-for-byte", () => {
        const reply = buildEpcReply({ epc: "E0123456789ABCDEF0123456", tid: "E2A41B7C93D02F184A65B901" });
        assert.equal(reply, buildFrame("61,1,N,EP:E0123456789ABCDEF0123456,ID:E2A41B7C93D02F184A65B901\r\n"));
    });
});
