alter table public.feature_settings drop constraint feature_settings_key_check;
alter table public.feature_settings add constraint feature_settings_key_check check(key in ('budgets','cancellation','payment_sources','payment_transactions'));
