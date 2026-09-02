import { buildFrame } from "../../utils/index.ts";
import { BatteryStatus, BufferStatus, ErrorNumber, MediaStatus, PrinterStatus, RibbonStatus } from "./enums.ts";
import { type EpcTid, type StatusSnapshot } from "./state.ts";

const PHASE_TO_STATUS: Record<StatusSnapshot["phase"], PrinterStatus> = {
    STANDBY: PrinterStatus.STANDBY,
    ANALYSING: PrinterStatus.ANALYSING,
    PRINTING: PrinterStatus.PRINTING,
    WAITING: PrinterStatus.WAITING,
};

/** Builds the DC2+PG status reply frame. Never NAKs. */
export const buildStatusReply = (snapshot: StatusSnapshot): string => {
    const ps = `PS${PHASE_TO_STATUS[snapshot.phase]}`;
    const rs = `RS${BufferStatus.BUFFER_AVAILABLE}`;
    const re = `RE${RibbonStatus.RIBBON_PRESENT}`;
    const pe = `PE${MediaStatus.MEDIA_PRESENT}`;
    const en = `EN${String(ErrorNumber.ONLINE).padStart(2, "0")}`;
    const bt = `BT${BatteryStatus.NORMAL}`;
    const q = `Q${String(snapshot.queueLength).padStart(6, "0")}`;

    const info = `${ps},${rs},${re},${pe},${en},${bt},${q}`;
    return buildFrame(`${info.length},${info}`);
};

/** Builds the DC2+PK reply frame — a non-destructive read of the last printed EPC/TID, or the
 * documented empty/no-result condition if nothing has finished printing yet. Never NAKs. */
export const buildEpcReply = (lastPrinted: EpcTid | null): string => {
    const body = lastPrinted ? `1,N,EP:${lastPrinted.epc},ID:${lastPrinted.tid}\r\n` : `0,A,EP:,ID:\r\n`;
    return buildFrame(`${body.length},${body}`);
};
