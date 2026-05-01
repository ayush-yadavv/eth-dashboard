# Agent Instructions

AI agent instructions for this repository (Cursor, Claude Code, and similar). Keep project facts aligned with `CLAUDE.md`; when you change migration numbers, commands, or module lists, update **both** files.

---

## Engineering Philosophy

### Core Principles

- **YAGNI with seams**: Don't build what you don't need, but design so it's easy to extend later. Leave doors unlocked, don't build the rooms.

- **DRY, pragmatically**: Duplication is cheaper than the wrong abstraction. Extract only when the pattern is proven (rule of three) and the abstraction is obvious.

- **Unix Philosophy**: Small, focused modules that compose well.

- **Convention over Configuration**: Sensible defaults. Minimize ceremony.

- **Domain-Driven Design**: Code should speak the language of the business. Model explicitly.

### Security (Top Priority)

- **OWASP Top 10**: Always guard against SQL injection, XSS, CSRF, broken auth, security misconfigs
- **Parameterized queries only**: Never concatenate user input into SQL/commands. Use sqlc.
- **Validate at boundaries**: Sanitize all external input (user input, APIs, webhooks)
- **Least privilege**: Minimal permissions, minimal exposure
- **No secrets in code**: Use environment variables. Never log secrets.
- **Remove obsolete code**: Dead code is attack surface. Delete it.

### Testing Philosophy

- **Integration tests first**: Test real behavior with real dependencies
- **Minimal mocking**: Mocks hide bugs. Use the real thing where possible.
- **Test behavior, not implementation**: Tests should survive refactors
- **Critical paths over coverage %**: Focus on what matters, not vanity metrics

### Guidelines

- Prefer simple code that's easy to change over clever code that's "flexible"
- Three similar lines > one premature abstraction
- Design for deletion, not extension
- When in doubt, inline it

---

## Deployment

- Railway config lives in `railway.json`
- Production build: `npm run build`
- Railway start command: `npm run start`
- Healthcheck path: `/health`

## Local Commands

- Lint: `npm run lint`
- Test: `npm run test`
- Build: `npm run build`

## Supabase Migrations

- Team task manager baseline schema: `supabase/migrations/20260501153000_team_task_manager.sql`
- RLS recursion fix: `supabase/migrations/20260501162000_fix_rls_recursion.sql`
- Member attendance tracking: `supabase/migrations/20260501173000_member_attendance.sql`
