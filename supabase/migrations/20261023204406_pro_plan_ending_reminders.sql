-- Distinguish confirmed Pro access ending from an upcoming charge.
alter table public.notification_events drop constraint notification_events_kind_check;
alter table public.notification_events add constraint notification_events_kind_check
  check (kind in ('renewal','trial','ending','candidate','digest','welcome','test'));

-- Informational tracking metadata, never an entitlement or authorization input.
alter table public.subscriptions add constraint subscription_pro_billing_owner
  check (not (data ? 'proBillingOwner') or (
    jsonb_typeof(data->'proBillingOwner') = 'string' and
    data->>'proBillingOwner' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ));
