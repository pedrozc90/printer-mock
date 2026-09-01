# Mock Behavior

## How the java applications works

- `PG + PK` = `"\u0002\u0012PG\u0012PK\u0003"`
- `PH` = `"\u0002\u0012PH\u0003"`
- `DEL` = `"\u0002\u0010H\u0003"`
- `DC1` = `"\u0002\u0011H\u0003"`

- Stablish TCP/IP Socket connection with printer.
- Reads a SBPL file; maintian as `String`.
- Send it to printer;
- Send a `PH` command; this cancel any ongoing printing process; Clear printer buffer.
- Send `PG + PK`; Using the string `[STX]12PG12PK[ETX]`.
- Start a reading loop; every 200ms read socket input stream.
- Parse input using `PG` and `PK` reponse; Creates an object of type `SatoInformation` (`PrinterStatus`, `ReceiveBuffer`, `RibbonStatus`, `MediaStatus`, `ErrorNumber`, `String` EPC, `Q` Integer).
- If parsing return `null`; Send another `PG + PK`.
- If receives 8x `PrinterStatus.STANDBY`; break the loop and assumes the printing process finished.
- If receives a `epc`, store it in a `Set<String>`; `TID` is ignored.

- User can trigger `DEL` or `DC1` any moment; loop keep sending `PG + PK`.
- User can trugger `PH`; loop breaks;

## Mock

the mock

1. Receive SBPL file, equal to `docs/printer/sample-1.txt` or `docs/printer/sample-2.txt`
