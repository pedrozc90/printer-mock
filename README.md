# printer-mock

Minimal TCP/IP socket server that mocks a SATO RFID printer, for local
development and testing when a real printer isn't available. Development-only —
never run in production.

It accepts a single TCP connection, unwraps the Java `ObjectOutputStream`
framing the client uses, reads `STX…ETX` frames as SATO commands or SBPL print
data, maintains printer state (buffer, per-tag print cycle, last printed
EPC/TID), and replies as a real printer would.

## Requirements

- Node.js >= 24 — native TypeScript, no build step (`mise.toml` pins the version)
- npm >= 11

## Run

```bash
npm start                    # listen on port 3000
npm start --port=4000        # listen on port 4000
npm run start:dev            # start with --watch
```

Port resolution: `--port=<n>` > `PORT` env var > `3000`.
One client connection at a time.

## Commands

| Client sends | Meaning                          | Mock reply                          |
| ------------ | -------------------------------- | ----------------------------------- |
| SBPL file    | new print job; EPCs queued       | none                                |
| `DC2` `PG`   | printer status                   | `STX <len>,PS…,Q… ETX`              |
| `DC2` `PK`   | last printed EPC/TID             | `STX <len>,1,N,EP:…,ID:… CR LF ETX` |
| `DC2` `PH`   | cancel job, clear buffer + state | `ACK`                               |
| `DLE`        | pause                            | `ACK` / `NAK`                       |
| `DC1`        | resume                           | `ACK` / `NAK`                       |

## Development

```bash
npm test           # node --test
npm run typecheck  # tsc --noEmit
npm run format:fix # prettier
```

## Docs

- `docs/mock-behavior.md` — simulated behavior and state machine
- `docs/printer-protocol.md` — evidence-based SATO protocol reference
- `docs/sato/` — SATO command specification PDFs
