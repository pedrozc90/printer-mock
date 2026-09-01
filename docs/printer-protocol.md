# SATO printer protocol — source of truth for the mock

This document records only what we have evidence for. Each fact is filed under the
source that supports it. Design decisions and assumptions are **not** in this document.

Sources:

- SATO command specifications for `PG`, `PK`, `PH`, and Return Status
- Two captured SBPL tag files: a ~60-tag sample and a 2-tag sample
- Real-printer log line: comment at `src/sato/sato.ts:146`
- Captured command bytes: `test/parse.test.ts`, `README.md`
- Direct statements from the user about running the real Java app against a real printer

Control bytes used below:

- `STX` = 0x02
- `ETX` = 0x03
- `ACK` = 0x06
- `LF` = 0x0A
- `CR` = 0x0D
- `DLE` = 0x10
- `DC1` = 0x11
- `DC2` = 0x12
- `NAK` = 0x15
- `ESC` = 0x1B

---

## SATO Documentation

### DC2 + PG — printer status acquisition

- Request: `DC2` + `PG` (`0x12 0x50 0x47`). No parameter.
- Function: This command returns the printer status.
- Accepted at any time, including during printing and during an error.
- Normal reply: `[STX]a,b…bc,d…de,…[ETX]` — **no comma before ETX**.
    - `a` = number of data bytes after `a` (the comma after `a` and the `ETX` are not counted).
    - then `name`+`data` pairs, all in text.
- Documented example: `[STX]32,PS0,RS0,RE0,PE0,EN00,BT0,Q000000[ETX]`
- Fields:

    | Field | Meaning                             | Values                                                                                              |
    | :---: | :---------------------------------- | --------------------------------------------------------------------------------------------------- |
    | `PS`  | Printer status                      | 0 standby (waiting for data), 1 waiting for dispensing, 2 analyzing, 3 printing, 4 offline, 5 error |
    | `RS`  | Receive buffer                      | 0 available, 1 near full, 2 full                                                                    |
    | `RE`  | Ribbon                              | 0 present, 1 near end, 2 none, 3 direct-thermal model                                               |
    | `PE`  | Media                               | 0 present, 2 none                                                                                   |
    | `EN`  | Error number                        | `00` online, `01` offline, `02`..`79` errors                                                        |
    | `BT`  | Battery                             | 0 normal, 1 near end, 2 error                                                                       |
    |  `Q`  | Remaining number of labels to print | `000000`–`999999`                                                                                   |

- Error reply: `[NAK]` (`0x15`).
- Battery is always `0` when running on mains power.
- Media reports `present` unless a paper-end occurs during printing.

> full list in the SATO `PG` spec or `src/sato/enums.ts`

### DC2 + PK — EPC/TID return request, UHF

- Request: `DC2` + `PK` (`0x12 0x50 0x4B`). No parameter.
- Function: Returns the status of RFID tag write by `<IP0>` command and EPC/TID
- **Cannot be received while the printer is operating → `[NAK]` reply.** Can be received during an error.
- Normal reply: `[STX]a,b,c,d…d[CR][LF][ETX]`
    - `a` = byte count from `b` up to (not including) `ETX`; comma after `a` and `ETX` not counted; max 5 digits.
    - `b` = write result: `0` failure, `1` success.
    - `c` = error symbol: `N` none, `E` EPC write error, `T` TID read error, `M` MCS error, `A` all errors.
    - `d` = `EP:<epc>` and/or `ID:<tid>` (comma-separated when both), text, max 256 chars.
- Which of EPC / TID / both is returned depends on the printer's "Data to Record" setting
  (`[DC2]PA` → `IF` → `DATA_TO_RECODE`: `0` both, `1` EPC only, `2` TID only).
- Documented examples:
    - `[STX]25,1,N,ID:E200680612345678[CR][LF][ETX]` — write ok, TID read ok (TID-only mode)
    - `[STX]9,1,T,ID:[CR][LF][ETX]` — write ok, TID read failed
    - `[STX]9,0,E,ID:[CR][LF][ETX]` — write failed
- Error reply: `[NAK]` (`0x15`).
- If EPC/TID read fails, the reply is returned without the data. If the job contains only an EPC
  write and no print data, `b`=`0` and `c`=`A`.

### DC2 + PH — cancel request

- Request: `DC2` + `PH` (`0x12 0x50 0x48`). No parameter.
- Function: This command cancels print jobs and clears the entire contents of receive buffer.
- Accepted during printing and during an error.
- Normal reply: `[ACK]` (`0x06`).
- Error reply: `[NAK]` (`0x15`).
- The reply is sent only after the cancel finishes; the host must wait for it before sending more data.

### DLE - pause request

- Request: `DLE` (`10H` = `0x10`)
- Function: This command stops the printing process.
- Normal replay: `[ACK]` (`0x06`)
- Error replay: `[NAK]` (`0x15`)
- Timing guidance: allow ≥ 500 ms between sending and receaving the reply
  (`ENQ`/`CAN` need ≥ 5 ms, or ≥ 300 ms over wireless LAN).

### DC1 - resume request

- Request: `DC1` (`11H` = `0x11`)
- Function: This command enables to release the print pause and resume printing.
- Normal replay: `[ACK]` (`0x06`)
- Error replay: `[NAK]` (`0x15`)
- Timing guidance: allow ≥ 500 ms between sending and receaving the reply
  (`ENQ`/`CAN` need ≥ 5 ms, or ≥ 300 ms over wireless LAN).

---

## Real Printer observations - Confirmed

- Real log line

    ```
    [ETX]S000000[STX]   [STX]32,PS0,RS0,RE0,PE0,EN00,BT0,Q000000[ETX]  [STX]A000000[ETX]   [STX]A000000[ETX]   [STX]S000000[ETX]   [STX]61,1,N,EP:3BE1000020DE9330000005CF,ID:E2806894200050092D95FCCA[CR][LF][ETX]
    ```

- The combination of `PG + PK` commands is possible;
  Each command reply independently;
  `PG` reply a block `STX` + `32,PS0,…,Q000000` + `ETX`;
  `PK` reply a block `STX` + `61,1,N,EP:<24 hex>,ID:<24 hex>` + `CR` + `LF` + `ETX`.
- The `PG` block `32,PS0,RS0,RE0,PE0,EN00,BT0,Q000000` is 35 chars;
  the prefix `32` is the length after the first comma;
  consistent with the SATO `PG` documentation.
- The `PK` block `1,N,EP:3BE1000020DE9330000005CF,ID:E2806894200050092D95FCCA` is 59 chars;
  the prefix `61` = 59 + 2, i.e. the length counts the trailing `CR LF`;
  consistent with the SATO `PK` documentation.
- Real EPC and TID are each 24 hex characters, uppercase in this log.
- TID is a unique identifier of a tag.
- The `S000000` / `A000000` tokens are meaning and origin are unknown.

---

## Java application notes - Confirmed

- Java 8 client over a plain TCP socket.
- Snippet:

    ```java
    void send(final String data) throws IOException {
      final ObjectOutputStream oos = new ObjectOutputStream(this.socket.getOutputStream());
      oos.writeObject(data);
    }
    ```

    No `flush()`, no `close()`; a new `ObjectOutputStream` per call.

- Consequently each message on the wire is a Java serialization stream:
  `AC ED 00 05` (stream magic + version) + `74` (`TC_STRING`) + 2-byte length + payload,
  or `7C` (`TC_LONGSTRING`) + 8-byte length + payload for payloads ≥ 64 KB.
  Payload text is (modified) UTF-8; for this data it is identical to the raw bytes.
    - Confirmed by `test/parse.test.ts` (e.g. `AC ED 00 05 74 00 03 12 50 47` = serialized `"\x12PG"`)
      and the escaped strings in `README.md`.
    - Those captured buffers use an **older** framing that split `PKPG` into four serialized
      strings (`"\x02"`, `"\x12PG"`, `"\x12PK"`, `"\x03"`); the user states the current code sends
      one string.

- Command byte sequences sent by the current app. The app wraps each DC2/DLE/DC1
  command in `STX ... ETX`, unlike the bare form in the SATO docs:

    | Command | Bytes (hex)                                                    |
    | :------ | :------------------------------------------------------------- |
    | pause   | `02 10 48 03` (STX, DLE, 'H', ETX)                             |
    | resume  | `02 11 48 03` (STX, DC1, 'H', ETX)                             |
    | cancel  | `02 12 50 48 03` (STX, DC2, 'P', 'H', ETX)                     |
    | poll    | `02 12 50 47 12 50 4B 03` (STX, DC2 'P' 'G', DC2 'P' 'K', ETX) |

- Tag-file-mode sequence: the app sends `PH`, then the tag file, then loops `PKPG` continuously
  while the printer prints.

- Cancel/Pause/Resume can be triggered/send at anty point of the printing process, after SBPL was sent.

### SBPL file

- References:
    - `docs/printer/sample-1.txt`
    - `docs/printer/sample-2.txt`
- Important Commands:
    - `ESC + A` **Start Code**: Specifying the start of data transmission.
    - `ESC + Z` **Stop Code**:Specifying the end of data transmission.
    - `ESC + IP0` **EPC Code Write (UHF)**: This command writes the EPC code and other data to the EPC corresponding RFID tag
- the label header starts with `ESC + A`.
- the label header starts with `ESC + Z`.
- the label body starts with `ESC + A`.
- the label body starts with `ESC + Z`.
- the label body ends with `ESC + Q1` (quantity 1) then `ESC + Z`.
- Each body contains its EPC exactly once in the form `0x1bIP0e:h,epc:<24 hex>,fsw:0;`
- `STX ... ETX` frames:
    - First frame: `STX \n \x12PI,SB \n <ESC commands> \n \x1bZ \n ETX` — a `DC2+PI` setup header.
    - Then one frame per tag: `STX … \x1bA … \x1bZ … ETX`.
- A larger SBPL file van have +1k tags; while the smaller one has 1.

---

## Unknown / needs investigation

- **`PH` replay**: not sure if `cancel request` reply is framed `STX ACK ETX` or just `ACK`.
- **Pause/resume request replay**: not sure if reply is framed `STX ACK ETX` or just `ACK`.

- **Printer → app wire bytes** for `PG`, `PK`, `PKPG`, `PH`, pause, resume: exact framing,
  whether wrapped in `STX … ETX`, `CR`/`LF` placement, and the meaning (if any) of the
  `S000000` / `A000000` tokens. Only the app's log line is available.
- **Which status protocol is actually in use**: bare `DC2+PG`/`DC2+PK`, Status 3/4 (`ENQ`/`CAN`),
  or Status 5 (`SOH+…`). The samples contain no status-poll traffic.
- **Timing**: per-tag print duration, how long each `PS` state lasts, the app's `PKPG` poll
  interval, and the poll→reply delay the app tolerates.
