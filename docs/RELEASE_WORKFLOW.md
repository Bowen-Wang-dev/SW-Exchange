# Release Workflow

## Standard Milestone Flow

1. Plan scope
2. Implement
3. Targeted build
4. Smoke
5. Manual review
6. Fix issues
7. Review task
8. Commit/push task
9. Report commit hash / branch / push result
10. Update docs and milestone copy

## Prompt Separation

- Keep the implementation prompt separate from the commit/push prompt.
- Do not commit during the implementation pass unless explicitly requested.
- Use a later dedicated pass for review, commit, and push.

## Verification Guidance

- Prefer targeted build/smoke for normal feature work.
- If schema changed, include the intended migration / seed workflow.
- If dependencies changed, run install and keep the lockfile updated.
- For UI-heavy work, include manual browser review.

## Milestone Hygiene

- Clean stale milestone/status copy every milestone.
- Update app-facing current milestone only after the implementation is truly done.
- Keep future milestones clearly planned-only.
- Do not imply planned features are live.

## Commit Message Examples

- `docs: add v0.18 ai-native project docs pack`
- `docs: align milestone copy for v0.18 context pack`
- `chore(docs): refresh roadmap and testing workflow`
