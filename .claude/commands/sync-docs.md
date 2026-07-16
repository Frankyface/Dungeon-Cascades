# /sync-docs — reconcile all session docs with what actually happened

Also triggered when Cam says "update all relevant files". Record ONLY reality — unverified ≠ working.

## Procedure
1. Review what ACTUALLY happened this session. Distinguish done-and-verified from merely-written; do not record unverified work as working.

2. Update as needed:
   - `handoff.md` — rewrite EVERY section in place. Enforce ≤60 lines. `✅ Things I've Changed` keeps only the last 5 dated entries, newest first. `❌ Watch Out` is max 3 one-liners, each linking to `docs/failed-approaches.md`. If the file is over budget, compressing it is part of the sync, not optional.
   - Active feature file(s) — set `Status` per the state machine; `verified done` requires a Verification Log entry with real evidence, no exceptions.
   - Stage `overview.md` — update if scope/DoD shifted or a feature status flipped.
   - `docs/decisions.md` — append new decisions with why + rejected alternatives.
   - `docs/failed-approaches.md` — append dead ends: root cause + do-instead.
   - `docs/master_plan.md` — only if the vision/roadmap genuinely changed.
   - `CLAUDE.md` — only if a rule, convention, or stack fact changed.
   - `new_session_prompt.md` + `.claude/commands/resume.md` — only if the resume instructions or the pointer changed.
   - `help.md` — add new human to-dos; check off completed ones.

3. Infer relevance from the session — do NOT quiz Cam about what to update.

4. Integrity check before finishing:
   - handoff.md's pointer resolves to the real current stage folder AND active feature file.
   - handoff.md is ≤60 lines.
   - Every `verified done` feature has a Verification Log entry with evidence.
   - No file left mid-edit.

5. Report back in 3–5 lines: what was updated and why, plus anything deliberately NOT updated.

6. Offer to commit as `docs: sync session state`.
