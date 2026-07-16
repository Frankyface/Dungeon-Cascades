# /verify — run the verification loop for the active feature

Purpose: prove a feature actually works by exercising it end-to-end, then record real evidence and update its status. Never weaken criteria to force a pass.

## Steps
1. Resolve the active feature file from `handoff.md`'s `🔗 Pointer`. Read its `Success Criteria` and `How We'll Verify` sections.
2. Execute the `How We'll Verify` steps FOR REAL: run the actual commands, exercise the behavior end-to-end. "It compiles" or "the tests I just wrote pass" do NOT count on their own — drive the real behavior and observe the real output.
3. Append a dated entry to the feature's `Verification Log`: the date, exactly what was run, and the ACTUAL output/result (paste real numbers, not a summary claim).
4. Update `Status` per the state machine `not started → in progress → awaiting verification → verified done`:
   - PASS ⇒ set `verified done`, tick the met `Success Criteria`, and sync the matching item in the stage `overview.md` checklist to `[x]`.
   - FAIL ⇒ status stays `in progress`; record the failure in the Verification Log; if it is a genuine dead end, append a `docs/failed-approaches.md` entry (root cause + do-instead).
5. If verification CANNOT be executed here (needs Cam's iPhone, an account, or other input you don't have): leave status at `awaiting verification`, add the blocker to `help.md`, and tell Cam explicitly. NEVER silently mark it done.

## Hard rules
- Game FEEL is judged only by Cam on-device — `/verify` never declares feel done.
- A feature with an empty Verification Log can never be `verified done`.
- Never weaken a Success Criterion to make it pass. Changing a criterion needs Cam's sign-off AND a `docs/decisions.md` entry.
