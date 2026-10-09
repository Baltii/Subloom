alter table public.profiles add column welcome_sent_at timestamptz;
create function public.record_welcome_acceptance() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('accepted','delivered') and exists(select 1 from public.notification_events where id=new.event_id and kind='welcome' and user_id=new.user_id) then
    update public.profiles set welcome_sent_at=coalesce(welcome_sent_at,now()) where user_id=new.user_id;
  end if;
  return new;
end $$;
create trigger remember_welcome after update of status on public.notification_deliveries for each row execute function public.record_welcome_acceptance();
revoke execute on function public.record_welcome_acceptance() from public,anon,authenticated;

create index evidence_retention on public.detection_evidence_metadata(received_at);
create index events_retention on public.notification_events(created_at);
create function public.purge_retained_metadata() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare evidence_count int; event_count int; webhook_count int; rate_count int;
begin
  delete from public.detection_evidence_metadata where id in (
    select id from public.detection_evidence_metadata where received_at < now()-interval '90 days' order by received_at limit 5000
  );
  get diagnostics evidence_count = row_count;
  -- Cascades delivery records; subscription and candidate details remain user-controlled.
  delete from public.notification_events where id in (
    select id from public.notification_events where created_at < now()-interval '90 days' order by created_at limit 5000
  );
  get diagnostics event_count = row_count;
  delete from public.webhook_receipts where id in (
    select id from public.webhook_receipts where created_at < now()-interval '30 days' order by created_at limit 5000
  );
  get diagnostics webhook_count = row_count;
  delete from public.rate_limit_buckets where bucket in (
    select bucket from public.rate_limit_buckets where window_start < now()-interval '1 day' order by window_start limit 5000
  );
  get diagnostics rate_count = row_count;
  -- Keep operation_results until account deletion: offline clients may retry old mutation IDs.
  return jsonb_build_object('evidence',evidence_count,'events',event_count,'webhooks',webhook_count,'rates',rate_count);
end $$;
revoke execute on function public.purge_retained_metadata() from public,anon,authenticated;
grant execute on function public.purge_retained_metadata() to service_role;
