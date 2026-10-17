import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useApp, readableError } from "../store/app";
import { workspaceData, workspaceRpc } from "../services/workspaces";
import {
  sharedSubscriptionSchema,
  splitCost,
  sharedCopy,
  shareSchema,
  memberSchema,
} from "../domain/workspaces";
import { subscriptionSchema, statuses } from "../domain/models";
import { moneyInput, parseMoney, formatMoney } from "../domain/money";
import {
  Button,
  Card,
  Chips,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
function SharedEditor({
  item,
  members,
  identity,
  reload,
}: {
  item: z.infer<typeof sharedSubscriptionSchema>;
  members: z.infer<typeof memberSchema>[];
  identity: string;
  reload: () => Promise<unknown>;
}) {
  const [name, setName] = useState(item.data.name),
    [amount, setAmount] = useState(
      moneyInput(item.data.amountMinor, item.data.currency),
    ),
    [renewal, setRenewal] = useState(item.data.nextRenewal),
    [status, setStatus] = useState(item.data.status),
    [manager, setManager] = useState(item.managed_by),
    [shares, setShares] = useState(
      Object.fromEntries(
        item.shares.map((s) => [
          s.userId,
          moneyInput(s.amountMinor, item.data.currency),
        ]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <View style={{ gap: 12 }}>
        <Heading size={18}>Edit {item.data.name}</Heading>
        <Field label="Shared name" value={name} onChangeText={setName} />
        <Field
          label={"Recorded price · " + item.data.currency}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Field
          label="Next renewal (YYYY-MM-DD)"
          value={renewal}
          onChangeText={setRenewal}
        />
        <Chips values={statuses} selected={status} onChange={setStatus} />
        <Label bold>Who manages billing?</Label>
        <Chips
          values={members.map((m) => m.user_id)}
          selected={manager}
          labels={Object.fromEntries(
            members.map((m) => [m.user_id, m.display_name]),
          )}
          onChange={setManager}
        />
        <Label bold>Cost split for each charge</Label>
        {members.map((m) => (
          <Field
            key={m.user_id}
            label={m.display_name + " · " + item.data.currency}
            value={shares[m.user_id] ?? "0"}
            onChangeText={(value) =>
              setShares((current) => ({ ...current, [m.user_id]: value }))
            }
            keyboardType="decimal-pad"
          />
        ))}
        <Button
          variant="secondary"
          onPress={() => {
            try {
              setShares(
                Object.fromEntries(
                  splitCost(
                    parseMoney(amount, item.data.currency),
                    members.map((m) => m.user_id),
                  ).map((s) => [
                    s.userId,
                    moneyInput(s.amountMinor, item.data.currency),
                  ]),
                ),
              );
              setError(null);
            } catch (e) {
              setError(readableError(e));
            }
          }}
        >
          Split equally
        </Button>
        <Button
          loading={busy}
          onPress={() => {
            setBusy(true);
            setError(null);
            void (async () => {
              const data = subscriptionSchema.parse({
                ...item.data,
                name,
                amountMinor: parseMoney(amount, item.data.currency),
                nextRenewal: renewal,
                status,
              });
              const split = members
                .map((m) =>
                  shareSchema.parse({
                    userId: m.user_id,
                    amountMinor: parseMoney(
                      shares[m.user_id] || "0",
                      data.currency,
                    ),
                  }),
                )
                .filter((s) => s.amountMinor > 0);
              if (!split.length)
                split.push({ userId: manager, amountMinor: 0 });
              if (
                split.reduce((sum, s) => sum + s.amountMinor, 0) !==
                data.amountMinor
              )
                throw new Error(
                  "Cost shares must add up to the recorded price.",
                );
              await workspaceRpc(identity, "save_workspace_subscription", {
                scope: item.workspace_id,
                subscription_data: data,
                billing_owner: manager,
                cost_shares: split,
                expected_version: item.version,
              });
              await reload();
            })()
              .catch((e) => setError(readableError(e)))
              .finally(() => setBusy(false));
          }}
        >
          Save shared subscription
        </Button>
        {error ? (
          <Label accessibilityRole="alert">
            {error} Reload shared spaces to recover from a conflicting edit.
          </Label>
        ) : null}
      </View>
    </Card>
  );
}
export function WorkspaceManager({
  identity,
  kind = "family",
}: {
  identity: string;
  kind?: "family" | "team";
}) {
  const personal = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo);
  const query = useQuery({
    queryKey: ["workspaces", identity, kind],
    enabled: identity !== "guest" && !demo,
    queryFn: async () => {
      const data = await workspaceData(identity);
      return {
        ...data,
        workspaces: data.workspaces.filter((w) => w.kind === kind),
      };
    },
  });
  const [name, setName] = useState(""),
    [memberName, setMemberName] = useState(""),
    [code, setCode] = useState(""),
    [invite, setInvite] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [deletion, setDeletion] = useState<{
      action: string;
      target: string | null;
    } | null>(null);
  const space = query.data?.workspaces.find((w) => w.id === selected),
    members =
      query.data?.members.filter((m) => m.workspace_id === selected) || [],
    items =
      query.data?.subscriptions.filter((s) => s.workspace_id === selected) ||
      [],
    owner = space?.owner_id === identity;
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await query.refetch();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={kind === "family" ? "Family shared spaces" : "Team shared spaces"}
      subtitle="Keep shared subscriptions, billing owners and cost splits in one place."
      back
    >
      <View style={{ gap: 18 }}>
        {kind === "family" ? (
          <Button
            variant="secondary"
            onPress={() => router.push("/settlements")}
          >
            Open Family Settlement Center
          </Button>
        ) : null}
        {identity === "guest" || demo ? (
          <Label>
            Sign in with your own account to create or join a shared space.
          </Label>
        ) : (
          <>
            <Button
              variant="secondary"
              loading={query.isFetching}
              onPress={() => {
                void query.refetch();
              }}
            >
              Reload shared spaces
            </Button>
            {query.error ? (
              <Label accessibilityRole="alert">{query.error.message}</Label>
            ) : null}
            <Field
              label="Your display name for shared spaces"
              value={memberName}
              onChangeText={setMemberName}
              maxLength={80}
            />
            <Card>
              <Field
                label="New workspace name"
                value={name}
                onChangeText={setName}
                maxLength={80}
              />
              <Button
                loading={busy}
                disabled={!name.trim() || !memberName.trim()}
                onPress={() =>
                  void run(async () => {
                    const id = await workspaceRpc(
                      identity,
                      kind === "team"
                        ? "create_team_workspace"
                        : "create_workspace",
                      {
                        workspace_name: name,
                        member_name: memberName,
                        ...(kind === "family"
                          ? { workspace_kind: "family" }
                          : {}),
                      },
                    );
                    setSelected(String(id));
                    setName("");
                  })
                }
              >
                {kind === "family"
                  ? "Create family workspace"
                  : "Create SSO team workspace"}
              </Button>
            </Card>
            <Card>
              <Field
                label="Invitation code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
              />
              <Button
                loading={busy}
                disabled={!code.trim() || !memberName.trim()}
                onPress={() =>
                  void run(async () => {
                    const id = await workspaceRpc(identity, "join_workspace", {
                      invite_token: code.trim(),
                      member_name: memberName,
                    });
                    setSelected(String(id));
                    setCode("");
                  })
                }
              >
                Join with invitation code
              </Button>
            </Card>
            {query.data?.workspaces.length ? (
              <Chips
                values={query.data.workspaces.map((w) => w.id)}
                selected={selected || ""}
                labels={Object.fromEntries(
                  query.data.workspaces.map((w) => [w.id, w.name]),
                )}
                onChange={(id) => {
                  setSelected(id);
                  setEditing(null);
                  setInvite(null);
                }}
              />
            ) : (
              <Label>No shared spaces yet.</Label>
            )}
            {space ? (
              <>
                <Heading size={22}>{space.name}</Heading>
                <Label>
                  {space.kind} · {members.length} members ·{" "}
                  {owner ? "You own this space" : "Read-only member access"}
                </Label>
                {owner ? (
                  <View style={{ gap: 12 }}>
                    <Button
                      loading={busy}
                      onPress={() =>
                        void run(async () => {
                          setInvite(
                            String(
                              await workspaceRpc(identity, "invite_workspace", {
                                scope: space.id,
                              }),
                            ),
                          );
                        })
                      }
                    >
                      Create invitation code
                    </Button>
                    {invite ? (
                      <Card>
                        <Label>
                          {kind === "team"
                            ? "Only members signed in through this organization’s SSO can use this code."
                            : "Anyone signed in with this code can join and read shared records."}{" "}
                          It expires in 48 hours and works once. Share
                          privately.
                        </Label>
                        <Label selectable>{invite}</Label>
                        <Button
                          variant="secondary"
                          onPress={() => {
                            void Clipboard.setStringAsync(invite).catch((e) =>
                              setError(readableError(e)),
                            );
                          }}
                        >
                          Copy invitation code
                        </Button>
                      </Card>
                    ) : null}
                    <Button
                      variant="ghost"
                      loading={busy}
                      onPress={() =>
                        void run(async () => {
                          await workspaceRpc(identity, "manage_workspace", {
                            scope: space.id,
                            action: "revoke_invites",
                          });
                          setInvite(null);
                        })
                      }
                    >
                      Revoke unused invitations
                    </Button>
                  </View>
                ) : null}
                <Heading size={19}>Members</Heading>
                {members.map((m) => (
                  <View key={m.user_id} style={{ gap: 8 }}>
                    <Label>
                      {m.display_name}
                      {m.user_id === space.owner_id ? " · Owner" : ""}
                    </Label>
                    {owner && m.user_id !== space.owner_id ? (
                      <Button
                        small
                        variant="ghost"
                        loading={busy}
                        onPress={() =>
                          void run(() =>
                            workspaceRpc(identity, "manage_workspace", {
                              scope: space.id,
                              action: "remove_member",
                              target: m.user_id,
                            }),
                          )
                        }
                      >
                        {"Remove " + m.display_name}
                      </Button>
                    ) : null}
                  </View>
                ))}
                <Heading size={19}>Shared subscriptions</Heading>
                {!items.length ? (
                  <Label>
                    No shared subscriptions. The owner can copy one below.
                  </Label>
                ) : null}
                {items.map((item) => (
                  <View key={item.id} style={{ gap: 12 }}>
                    <Card>
                      <View style={{ gap: 8 }}>
                        <Heading size={19}>{item.data.name}</Heading>
                        <Label>
                          {formatMoney(
                            item.data.amountMinor,
                            item.data.currency,
                          )}{" "}
                          {item.data.currency} · {item.data.interval} ·{" "}
                          {item.data.status} · next {item.data.nextRenewal}
                        </Label>
                        <Label>
                          Billing owner:{" "}
                          {members.find((m) => m.user_id === item.managed_by)
                            ?.display_name || "Member"}
                        </Label>
                        {item.shares.map((share) => (
                          <Label key={share.userId}>
                            {members.find((m) => m.user_id === share.userId)
                              ?.display_name || "Member"}
                            :{" "}
                            {formatMoney(share.amountMinor, item.data.currency)}{" "}
                            {item.data.currency} per charge
                          </Label>
                        ))}
                        {owner ? (
                          <>
                            <Button
                              variant="secondary"
                              onPress={() =>
                                setEditing(editing === item.id ? null : item.id)
                              }
                            >
                              Edit shared details
                            </Button>
                            <Button
                              variant="danger"
                              onPress={() =>
                                setDeletion({
                                  action: "delete_subscription",
                                  target: item.id,
                                })
                              }
                            >
                              Remove shared subscription
                            </Button>
                          </>
                        ) : null}
                      </View>
                    </Card>
                    {owner && editing === item.id ? (
                      <SharedEditor
                        key={item.id + ":" + item.version}
                        item={item}
                        members={members}
                        identity={identity}
                        reload={() => query.refetch()}
                      />
                    ) : null}
                  </View>
                ))}
                {owner ? (
                  <>
                    <Heading size={19}>Copy a personal subscription</Heading>
                    <Label>
                      Copying shares the recorded name, price, category, status
                      and dates with members. Private notes, payment methods and
                      reminders are removed. The personal record remains
                      separate.
                    </Label>
                    {personal.map((s) => (
                      <Button
                        key={s.id}
                        variant="secondary"
                        loading={busy}
                        onPress={() =>
                          void run(() =>
                            workspaceRpc(
                              identity,
                              "save_workspace_subscription",
                              {
                                scope: space.id,
                                subscription_data: sharedCopy(
                                  s,
                                  Crypto.randomUUID(),
                                ),
                                billing_owner: identity,
                                cost_shares: [
                                  {
                                    userId: identity,
                                    amountMinor: s.amountMinor,
                                  },
                                ],
                                expected_version: 0,
                              },
                            ),
                          )
                        }
                      >
                        {"Share a copy of " + s.name}
                      </Button>
                    ))}
                    <Button
                      variant="danger"
                      onPress={() =>
                        setDeletion({
                          action: "delete_workspace",
                          target: null,
                        })
                      }
                    >
                      Delete shared workspace
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    loading={busy}
                    onPress={() =>
                      void run(async () => {
                        await workspaceRpc(identity, "manage_workspace", {
                          scope: space.id,
                          action: "leave",
                        });
                        setSelected(null);
                      })
                    }
                  >
                    Leave shared workspace
                  </Button>
                )}
              </>
            ) : null}
          </>
        )}
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      </View>
      <Confirm
        visible={!!deletion}
        title="Remove shared data?"
        body="This permanently removes the selected shared record or entire workspace and its memberships. Personal subscription records remain separate."
        action="Remove shared data"
        danger
        onClose={() => setDeletion(null)}
        onConfirm={async () => {
          if (!space || !deletion) return;
          const item = items.find((i) => i.id === deletion.target);
          await workspaceRpc(identity, "manage_workspace", {
            scope: space.id,
            action: deletion.action,
            target: deletion.target,
            expected_version: item?.version,
          });
          if (deletion.action === "delete_workspace") setSelected(null);
          await query.refetch();
        }}
      />
    </Page>
  );
}
export default function Workspaces() {
  const identity = useApp((s) => s.identity);
  return <WorkspaceManager key={identity} identity={identity} />;
}
