# Mock Behavior

The mock acts as a **SATO printer**.

The Java application establishes a TCP/IP connection to the mock and communicates with it using SBPL commands.
The mock receives the application's commands, maintains an internal printer state and EPC buffer, and reply as a real printer would.

## Java applications

The Java application is the TCP/IP client.

Its printing flow is:

1. Establish a TCP/IP socket connection with the printer.
2. Read the SBPL file and keep it as a `String`.
3. Send the `PH` command to cancel any ongoing printing process and clear printer buffer.
4. Send the SBPL file to the printer;
5. Send `PG + PK` command.
6. Sleeps for 500 ms.
7. Start a status-reading loop;
8. Every 200ms:

- Read data from the socket inputstream.
- Parse received data as `PG` / `PK` replys.
- Create a `SatoInformation` object containing:
    - `PrinterStatus`
    - `ReceiveBuffer`
    - `RibbonStatus`
    - `MediaStatus`
    - `ErrorNumber`
    - `EPC` (String)
    - `Q` = remainingBuffer (Integer)

9. If parsing returns `null`, send another `PG + PK`.
10. If `PrinterStatus.STANDBY` is received **8 consecutives times**, assumes the printing process finished and exit the status-reading loop.
11. Whenever an EPC is received, add it to a `Set<String>` (duplicates are expected, since
    `DC2 + PK` can return the same EPC/TID across multiple polls — see `DC2 + PK` below).
12. TIDs returned by the printer are ignored by the application.

### Commands

|   Name    | Command send via socket          |
|:---------:|:---------------------------------|
| `PG + PK` | `"\u0002\u0012PG\u0012PK\u0003"` |
|   `PH`    | `"\u0002\u0012PH\u0003"`         |
|   `DLE`   | `"\u0002\u0010H\u0003"`          |
|   `DC1`   | `"\u0002\u0011H\u0003"`          |

The user can trigger `PH`, `DLE` or `DC1` command at any point of the printing process.
The `PH` command exit the status-reading loop.
The `DLE` and `DC1` just bypass the `STANDBY` logic, but keeps sending `PG + PK`.

---

## Mock Printer

The mock listens for the Java application's TCP/IP connection and behaves as a simplified SATO printer.
We are assuming that the printer can maintain only one socket connection at time.

The mock maintains three important pieces of state:

- Printer state — whether the printer is printing, analysing, paused, etc.
- Printer buffer — EPC/TID pairs extracted from the SBPL file, not yet finished printing.
- Last printed EPC/TID — the most recently completed tag's EPC/TID pair, if any.

Mock state persists across TCP disconnects: closing and reopening the connection does **not**
reset the printer buffer, the last printed EPC/TID, `paused`, or an in-progress print cycle —
matching real hardware, where printing continues independently of the host connection. Only
`DC2 + PH` clears this state (see below).

### Receiving data

The mock receives raw bytes from the socket.

Because TCP does not preserve application-level message boundaries, a single SBPL frame may arrive in multiple socket reads.

The mock therefore:

1. Accumulates received bytes.
2. Identifies complete frames from `STX` through `ETX`.
3. Processes only complete frames.
4. Keeps incomplete data until the remaining bytes arrive.
5. If the held incomplete data exceeds a bounded size (about 1 MB), it is discarded and a warning
   is logged, rather than growing without limit — this only matters for a malformed or truncated
   stream, since well-formed frames are always far smaller.

A complete frame is delimited by `STX ... ETX`.

A single frame may contain more than one command (e.g. `DC2 + PG` followed by `DC2 + PK`, as the
Java client always sends them). Each command in the frame is processed independently, in order,
and each produces its own reply frame — a combined `PG + PK` request produces two separate
`STX ... ETX` reply frames, not one merged frame.

### SBPL Printing Data

When the mock receives an SBPL file, it represents the beginning of a new printing process.
The SBPL file can be large, and the bytes received from the socket may contain only part of the file.
The mock must therefore process the complete received SBPL data as a sequence of print blocks.

#### Print blocks

A **print block** starts with `ESC + A` and ends with `ESC + Z`

For every complete **print block**:

1. If the block contains a line starting with `ESC + PM`, set `paused = false`. `ESC + PM` is
   expected only once, in the SBPL label header — this marks the start of a new printing process.
2. For each line starting with `ESC + IP0`:
   1. If the line has no `epc:` parameter, skip it — no other `ESC + IP0` parameter matters to
      the mock.
   2. Otherwise, extract the EPC from the `epc:` parameter, generate a random TID
      (`src/utils/utils.ts` `generateTID(12)`) — fixed for this EPC; the same TID is returned by
      every `DC2 + PK` reply for this EPC, including repeated polls — and add the EPC/TID pair to
      the **printer buffer**.
   3. Extracting an EPC also sets `paused = false`, same as `ESC + PM`. This is a deliberate,
      redundant safety net alongside `DC2 + PH` (which already resets `paused` before every new
      SBPL job per the client flow) and `ESC + PM` (not guaranteed to be present or detected) —
      the first EPC of a new job is a third, independent trigger for the same reset.
3. A block with neither `ESC + PM` nor a usable `ESC + IP0` is skipped — nothing is added to the
   buffer and `paused` is left unchanged.

The printer buffer behaves as a queue: entries are printed in the order they were added. Printing
an entry (see "Printer status progression" under `DC2 + PG`) removes it from the printer buffer
and sets it as the **last printed EPC/TID** — the value `DC2 + PK` returns — regardless of
whether, or how many times, `DC2 + PK` was called for the previous entry.

---

### Printer State

The mock should maintain the following logical states:

- `STANDBY`
- `ANALYSING`
- `PRINTING`
- `WAITING`

`WAITING` is only used after a **pause request**.

During normal operation, while the printer buffer is non-empty, the mock advances through a
per-tag cycle:

`STANDBY → ANALYSING → PRINTING → STANDBY → …`

This simulates the printer progressing through the printing process, one tag per cycle. See
"Printer status progression" (under `DC2 + PG`) for the exact timing and buffer interaction.

When paused, PG must return `WAITING`

### DLE - Pause Request

When the mock receives a `DLE` command:

1. If `paused` is `false`
   1. Set `paused = true`
   2. Wait ~500 ms.
   3. Reply with `ACK` (no `STX ... ETX` frame).
2. If `paused` is already `true`
   1. Wait ~500 ms.
   2. Reply `NAK` (no `STX ... ETX` frame).

The printer remains paused until a `DC1` command is received.
The printer reply to `PG` with `PrinterStatus.WAITING` while `paused == true`.

---

### DC1 - Resume Request

When the mock receives a DC1 command:

1. Printer is paused - If `paused == true` - then:
    1. Set `paused = false`.
    2. Resume the interrupted `ANALYSING`/`PRINTING` phase from where it left off (see "Printer
       status progression" under `DC2 + PG`).
    3. Wait 500 ms.
    4. Reply with `ACK` (no `STX ... ETX` frame).
2. Printer is not paused - If `paused == false` - then:
    1. Wait 500 ms.
    2. Reply with `NAK` (no `STX ... ETX` frame).

---

### DC2 + PH - Cancel

When the mock receives `DC2 + PH`

the current printing process is cancelled.

The mock must:

1. Clear the printer buffer.
2. Clear the **last printed EPC/TID**. Subsequent `DC2 + PK` requests return the empty/no-result
   condition until a new tag finishes printing.
3. Reset printing state to `STANDBY`:
   - Abort any in-progress `ANALYSING`/`PRINTING` cycle.
   - Set `paused = false`.
4. Reply `ACK` (no `STX ... ETX` frame)
   - It can possibly reply `ACK` or `NAK`;
   - However, since we don't know how it really works, lets always reply `ACK` (successfully cancelled).
   - has a ~500 ms delay

---

# DC2 + PG - Printer Status Acquisition

When the mock receives `DC2 + PG`.
it must return the current printer status.
Never reply `NAK`.

The response contains:

| Field           | Mock behavior                                                                             |
|:----------------|:------------------------------------------------------------------------------------------|
| `PrinterStatus` | During printing process `STANDBY`, `ANALYSING` or `PRINTING`; `WAITING` only while paused |
| `BufferStatus`  | Always `BUFFER_AVAILABLE` — the mock has no real capacity limit to simulate               |
| `RibbonStatus`  | Always `RIBBON_PRESENT`                                                                   |
| `MediaStatus`   | Always `MEDIA_PRESENT`                                                                    |
| `ErrorNumber`   | Always `ONLINE (0)`                                                                       |
| `BatteryStatus` | Always `NORMAL (0)`                                                                       |
| `Q`             | Number of remaining entries in the **printer buffer**                                     |

## Printer status progression

The printer status is driven by a per-tag print cycle that runs autonomously against the
**printer buffer** — the printer keeps working through the buffer on its own timing, entirely
independent of whether, or how often, `DC2 + PK` is called:

- While the buffer is empty and no tag is currently mid-cycle, `PrinterStatus` is `STANDBY`.
- When the buffer has at least one pending EPC/TID entry and the printer is not paused, the mock
  starts a cycle for the entry at the front of the buffer:
    1. `ANALYSING` for ~250 ms.
    2. `PRINTING` for ~300 ms.
    3. Once the `PRINTING` phase completes, that entry is removed from the printer buffer and
       becomes the **last printed EPC/TID** (see `DC2 + PK` below), and the printer returns to
       `STANDBY`.
- If the buffer still has entries once a cycle completes, the mock immediately starts the next
  entry's cycle. If the buffer is empty, the printer holds at `STANDBY`.
- Time spent in `ANALYSING`/`PRINTING` is simulated elapsed time, not counted per poll — a
  `DC2 + PG` request simply reports whichever phase the mock is currently in, based on how much
  time has passed since that phase started.
- While paused (`paused == true`), the cycle is suspended: no `ANALYSING`/`PRINTING` time
  elapses, and `PG` returns `WAITING`. Resuming (`DC1`) continues the interrupted phase from
  where it left off — elapsed time already spent in that phase before the pause is preserved,
  not reset.

This progression is deterministic (fixed durations, no randomness) so tests can reliably exercise
the Java application's status-handling logic — including the "8 consecutive `STANDBY`" completion
check: once the buffer is fully drained, `STANDBY` is returned indefinitely, regardless of how
many (if any) `DC2 + PK` requests were made along the way.

---

# DC2 + PK - EPC / TID Acquisition

When the mock receives `DC2 + PK`
it must return the **last printed EPC/TID** — the most recently completed tag (see "Printer
status progression" under `DC2 + PG`) — not a queue to consume.
The request is read-only: it does **not** remove or advance anything, so repeated `DC2 + PK`
requests return the same EPC/TID for as long as no new tag has finished printing since the
previous one. The Java application is expected to see (and dedupe, via its `Set<String>`) the
same EPC/TID multiple times.
Never reply `NAK`.

The mock should:

1. If no tag has finished printing since the current print job started (or since the last
   `DC2 + PH`), reply with the empty/no-result condition: `13,0,A,EP:,ID:[CR][LF]`.
2. Otherwise, reply with the **last printed EPC/TID**, e.g.:
   - EPC `E0123456789ABCDEF0123456`
   - TID `E2A41B7C93D02F184A65B901`
   1. Build reply like `1,N,EP:E0123456789ABCDEF0123456,ID:E2A41B7C93D02F184A65B901[CR][LF]`;
   2. Calculate the number of bytes (include `CR` and `LF`);
   3. Reply `61,1,N,EP:E0123456789ABCDEF0123456,ID:E2A41B7C93D02F184A65B901[CR][LF]`; `61,` is the
      number of bytes calculated in the previous step.

The Java application stores the returned EPC in a `Set<String>` — duplicates across polls are
expected and are deduplicated on the client side, not by the mock.
The TID is returned by the mock but ignored by the Java application.

---

# Internal Printer Buffer

The printer buffer contains the EPC/TID pairs extracted from the SBPL data, not yet finished
printing. The per-tag print cycle (see "Printer status progression" under `DC2 + PG`) consumes it
autonomously, one entry at a time, independent of `DC2 + PK`.

Conceptually:

```text
SBPL
  │
  ├── Print block 1 ──> EPC/TID ──┐
  ├── Print block 2 ──> EPC/TID ──┤
  ├── Print block 3 ──> EPC/TID ──┤
  └── Print block N ──> EPC/TID ──┘
                                  │
                                  ▼
                         Printer buffer (queue)
                                  │
                    per-tag print cycle (autonomous)
                                  │
                                  ▼
                     Last printed EPC/TID (register)
                                  │
                   DC2 + PK request (read-only, repeatable)
                                  │
                                  ▼
                  Return last printed EPC/TID, unchanged
```

The printer buffer and the last printed EPC/TID are both cleared when the mock receives
`DC2 + PH`.
