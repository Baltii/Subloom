create function public.validate_contract_types(d jsonb, strings text[], numbers text[], nullable_strings text[]) returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  foreach k in array strings loop
    if jsonb_typeof(d->k) is distinct from 'string' then return false; end if;
  end loop;
  foreach k in array numbers loop
    if jsonb_typeof(d->k) is distinct from 'number' then return false; end if;
  end loop;
  foreach k in array nullable_strings loop
    if not d ? k or jsonb_typeof(d->k) not in ('string','null') then return false; end if;
  end loop;
  return true;
end $$;
create function public.validate_candidate(d jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  foreach k in array array['id','merchant','serviceId','amountMinor','currency','interval','chargeDate','nextRenewal','trialEnd','confidence','source','fingerprint','reference','missingFields','explanation','kind','matchedSubscriptionId','state','createdAt'] loop
    if not d ? k then return false; end if;
  end loop;
  if d->>'id' is null or d->>'merchant' is null or d->>'fingerprint' is null or d->>'explanation' is null then return false; end if;
  if length(d->>'merchant')>80 or length(d->>'fingerprint')>128 or length(d->>'explanation')>600 or length(d->>'reference')>160 then return false; end if;
  if jsonb_typeof(d->'confidence') is distinct from 'number' or (d->>'confidence')::numeric not between 0 and 1 then return false; end if;
  if d->>'amountMinor' is not null and (jsonb_typeof(d->'amountMinor')<>'number' or d->>'amountMinor' !~ '^[0-9]+$' or (d->>'amountMinor')::bigint not between 0 and 1000000000) then return false; end if;
  if d->>'currency' is not null and d->>'currency' not in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR') then return false; end if;
  if d->>'interval' is not null and d->>'interval' not in ('weekly','monthly','quarterly','yearly','custom') then return false; end if;
  if d->>'source' is null or d->>'source' not in ('receipt','screenshot','connected_email') then return false; end if;
  if d->>'kind' is null or d->>'kind' not in ('new','renewal','price_change','cancellation','refund','one_time','unknown') then return false; end if;
  foreach k in array array['chargeDate','nextRenewal','trialEnd'] loop
    if d->>k is not null and ((d->>k) !~ '^\d{4}-\d{2}-\d{2}$' or (d->>k)::date::text<>d->>k) then return false; end if;
  end loop;
  if jsonb_typeof(d->'missingFields') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'missingFields')>10 or exists(select 1 from jsonb_array_elements(d->'missingFields') v where jsonb_typeof(v)<>'string') then return false; end if;
  perform (d->>'createdAt')::timestamptz;
  return true;
exception when others then return false;
end $$;
alter table public.detected_candidates add constraint valid_candidate_contract check(public.validate_candidate(data));
alter table public.detected_candidates add constraint candidate_json_types check(public.validate_contract_types(data,
  array['id','merchant','source','fingerprint','explanation','kind','state','createdAt'], array['confidence'],
  array['serviceId','currency','interval','chargeDate','nextRenewal','trialEnd','reference','matchedSubscriptionId']
));
alter table public.subscriptions add constraint subscription_json_types check(public.validate_contract_types(data,
  array['id','userId','name','category','currency','interval','customUnit','startDate','nextRenewal','status','paymentMethod','notes','source','createdAt','updatedAt'],
  array['amountMinor','intervalCount','anchorDay','version'], array['serviceId','trialEnd','canceledAt','paidThrough']
) and data ? 'reminders' and (data->'reminders'='null'::jsonb or (
  jsonb_typeof(data->'reminders') is not distinct from 'object' and jsonb_typeof(data->'reminders'->'enabled') is not distinct from 'boolean' and jsonb_typeof(data->'reminders'->'days') is not distinct from 'array'
)));
alter table public.subscription_activity add constraint activity_json_types check(public.validate_contract_types(data,
  array['id','type','title','detail','createdAt'], array[]::text[], array['targetId']
) and data->>'id'=id::text and data->>'type' in ('created','edited','canceled','paused','resumed','deleted','detected','dismissed','confirmed','reminder'));
alter table public.subscriptions add constraint integer_fields check(
  jsonb_typeof(data->'intervalCount')='number' and data->>'intervalCount' ~ '^[0-9]+$' and
  jsonb_typeof(data->'anchorDay')='number' and data->>'anchorDay' ~ '^[0-9]+$'
);
alter table public.user_preferences add constraint required_preference_fields check(
  data->>'appearance' is not null and data->>'currency' is not null
);
alter table public.user_preferences add constraint valid_high_renewal_threshold check (
  data->>'highRenewalThresholdMinor' is null or (
    jsonb_typeof(data->'highRenewalThresholdMinor')='number' and
    data->>'highRenewalThresholdMinor' ~ '^[0-9]+$' and
    (data->>'highRenewalThresholdMinor')::numeric between 0 and 1000000000
  )
);
revoke execute on function public.validate_candidate(jsonb) from public,anon,authenticated;
revoke execute on function public.validate_contract_types(jsonb,text[],text[],text[]) from public,anon,authenticated;
grant execute on function public.validate_candidate(jsonb),public.validate_contract_types(jsonb,text[],text[],text[]) to service_role;
