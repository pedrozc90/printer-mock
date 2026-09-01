# CLAUDE.md

## About

- Simple TCP/IP socket server used to simulate/mock a SATO RFID printer.
- Development-only tool; never runs in production.
- Used because a real SATO printer is not always available.

## Code Style

- Uses Node.js native TypeScript support.
- Prefer functions over classes.
- Prefer simple, small functions with a single responsibility.
- Prefer composition when it solves an actual problem.
- Prefer `async` / `await` over Promise chains.
- Use `const` by default; use `let` only when reassignment is necessary.
- Avoid `any`; use explicit types.
- Prefer TypeScript type inference when the type is obvious.
- Keep functions and modules small and focused.

## Architecture

- Keep the TCP server simple and easy to understand.
- Keep SATO printer protocol/mock behavior separate from TCP/socket handling.
- Avoid introducing frameworks or unnecessary dependencies.
- Prefer Node.js built-in APIs when they are sufficient.

## Mock Behavior

- Prefer predictable and deterministic behavior.
- Do not silently change the simulated printer protocol/behavior.
- When changing protocol behavior, clearly identify the expected behavior change.
- Keep mock behavior representative of the real SATO printer rather than adding unnecessary realism.

## Testing

- Changes to printer behavior should include or update tests when practical.
- Prefer testing protocol behavior rather than implementation details.
- Do not make tests depend on a real SATO printer.

## Development

- Before making changes, inspect the existing implementation and follow its conventions.
- Make the smallest change necessary.
- Do not refactor unrelated code.
- Do not add abstractions, patterns, or dependencies unless they provide a clear benefit for this small project.
- When requirements are ambiguous, ask before making assumptions about SATO protocol behavior.

## Commands

- `npm run typecheck` — type-check the project.
- `npm run format:fix` — format the code.

## Safety

- Never run `git add`.
- Never run `git commit`.
- Never run `git push`.
- Git read-only operations such as `status`, `diff`, and history inspection are allowed.
