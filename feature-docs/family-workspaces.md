# Family shared workspaces

**Hosted setup, 2026-10-11:** Migrations 003 and 005 applied; hosted invitations, billing splits, owner edits and family access passed. See [setup progress](setup-progress.md).

Settings → Family workspaces requires sign-in and a connection. Create a named space with your display name. Owners generate single-use invitation codes valid for 48 hours, share them privately, and can revoke all unused invitations. Anyone signed in with a valid code can join and read the shared records: there is no automatic email invitation. The code is shown once and only its SHA-256 hash is stored. Failed join attempts are rate-limited; membership/invite limits bound access.

Owners explicitly copy a personal subscription into the shared space. The copy removes private notes, payment-method text and reminders, and has a separate ID. It never moves or edits the personal record. Members can read shared subscription dates/prices, the assigned billing owner and cost splits. Owners edit those details with server version checks; split amounts must exactly sum to the recorded price and reference current members. An equal-split action allocates integer remainders without losing minor units. Shared and personal totals remain separate to avoid silently double-counting copied records. Workspace subscriptions currently use workspace screens, not the personal reminder scheduler.

Owners can remove shared records, remove members (after reassigning billing ownership and shares), revoke invitations or delete the workspace. Members can leave after their billing/share assignments are reassigned. Workspace deletion is confirmed and cascades its records, members and invitations. Deleting the owner’s account also deletes owned workspaces. Deleting a member’s account removes its membership and reassigns its recorded cost share/billing assignment to the owner, so account deletion cannot be blocked by a shared assignment. This changes tracking only, never transfers a real merchant contract. Members cannot mutate shared records or administer membership. RLS enforces access independently of the UI and credentials never enter shared rows.

## Setup

Apply `202610110003_workspaces.sql`. Existing Supabase configuration suffices; no new provider credentials. Stacked after price history. Guest/demo workspace creation is disabled. These are cloud features; errors/reload are visible and no offline writes are silently queued.

## Validation

`npm run check` includes real PostgreSQL tests for creation, invite expiration/replay, cross-account reads, unauthorized writes, billing/share validation, optimistic conflicts, revocation and member removal. Unit tests cover exact integer cost splitting and private-copy stripping.
