# Account Isolation Verification

Student OS now restores workspaces only after the authenticated account has been identified and its server workspace has been checked.

| Scenario                                                       | Expected behavior                                                                                                                                | Verification                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Returning student opens Student OS                             | Their profile, lessons, tasks, exams, and preferences are restored from the workspace associated with their authenticated account.               | Covered by hydration gate and per-account server workspace flow. |
| Friend opens a shared link and signs in to a different account | The previous student's local browser cache is cleared before the new account can render. The friend receives the clean six-step onboarding flow. | Covered by `workspaceIsolation.test.ts`.                         |
| Browser cache has no account owner (legacy cache)              | It is treated as private and is not shown to a new account.                                                                                      | Covered by `workspaceIsolation.test.ts`.                         |

The regression suite completed with **20 test files and 70 tests passing**. The client and server production bundles were also compiled separately after the combined build process encountered sandbox memory pressure.

## Final hardening

- Importing a backup now saves it to the signed-in student's server workspace before the interface reports success.
- Clearing a workspace now cancels queued uploads and clears the authenticated account's remote copy, preventing removed data from returning after a reload.
- Restarting onboarding keeps study data but saves the profile-reset state to the same student's account before routing to onboarding.
- The onboarding restart regression test confirms that bookmarked Daily Lessons, along with tasks and notes, remain available to that student.
