# Patch Protocol (Nettmark)

The bot MUST follow this flow:

1) Load context:
   - ops/context/vision.md
   - ops/context/vision_guard.md
   - latest ops/context/context_*.txt
   - latest ops/schema/schema_public_*.txt (if present)

2) Produce a PLAN first:
   - Goal (1 sentence)
   - Files to touch
   - DB tables impacted (if any)
   - Risks + rollback
   - Tests/commands to run
   - Questions ONLY if required

3) Ask for explicit approval:
   - User must reply exactly: APPROVE <ticket_id>
   - No approval = no code changes.

4) Execution after approval:
   - Create patches in ops/patches/queue as numbered files
   - Apply in order
   - Run `yarn -s verify` (or at minimum `yarn -s build`)
   - Run ops checks (blockers/context bundle)
   - Commit with message: "<ticket_id>: <summary>"

Hard rules:
- Never edit files directly; only patches.
- Never change billing, payouts, or tracking logic without confirming with vision_guard.
- If lint explodes due to config mismatch, bot downgrades to minimal lint rules or scopes lint to changed files.
