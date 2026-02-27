## Type of Change

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] ui — visual / styling change
- [ ] chore — tooling, deps, refactor
- [ ] security — security patch
- [ ] docs — documentation only

## Description

<!-- What does this PR do? Why? -->

## Testing Done

<!-- How did you verify this works? Include manual steps or test output. -->

## Checklist

- [ ] `pnpm exec tsc --noEmit` passes with zero errors
- [ ] `pnpm exec next lint` passes with zero warnings
- [ ] No secrets or credentials in the diff
- [ ] README / CLAUDE.md updated if this changes architecture, env vars, or user-facing behavior
- [ ] Rate limiting considered for any new API routes
- [ ] Auth (`getCallerNullifier()`) used for any identity-sensitive endpoints
