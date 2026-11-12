-- Expand the allowlist while preserving existing subscription validation and privileges.
create or replace function public.validate_subscription(d jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  foreach k in array array['id','userId','name','category','amountMinor','currency','interval','intervalCount','customUnit','startDate','nextRenewal','anchorDay','status','paymentMethod','notes','source','createdAt','updatedAt','version'] loop
    if d->>k is null then return false; end if;
  end loop;
  if jsonb_typeof(d->'amountMinor') <> 'number' or (d->>'amountMinor') !~ '^[0-9]+$' then return false; end if;
  if d->>'category' not in (
    'Entertainment',
    'Music',
    'Productivity',
    'Cloud & storage',
    'Health & fitness',
    'Education',
    'Video streaming',
    'Movies & TV',
    'Gaming',
    'Live TV',
    'Sports',
    'Podcasts',
    'Audiobooks',
    'News',
    'Magazines',
    'Books & reading',
    'Comics & manga',
    'Social media',
    'Communities',
    'Dating',
    'AI tools',
    'Writing',
    'Design',
    'Photography',
    'Video editing',
    'Audio production',
    'Development',
    'Web hosting',
    'Domains',
    'Email',
    'VPN & privacy',
    'Security',
    'Password managers',
    'Backup',
    'File sharing',
    'Project management',
    'Team collaboration',
    'Video conferencing',
    'Customer support',
    'CRM',
    'Marketing',
    'Analytics',
    'Accounting',
    'Invoicing',
    'E-commerce',
    'Business',
    'Language learning',
    'Online courses',
    'Kids & family',
    'Meditation',
    'Mental wellness',
    'Nutrition',
    'Healthcare',
    'Beauty & wellness',
    'Food & groceries',
    'Meal kits',
    'Coffee & tea',
    'Delivery',
    'Shopping memberships',
    'Transport',
    'Travel',
    'Automotive',
    'Home & utilities',
    'Internet',
    'Mobile plans',
    'Insurance',
    'Finance',
    'Investing',
    'Pets',
    'Charity & donations',
    'Other'
  ) then return false; end if;
  if d->>'customUnit' not in ('day','week','month','year') or d->>'source' not in ('manual','receipt','screenshot','notification','connected_email') then return false; end if;
  if length(d->>'name') not between 1 and 80 or length(d->>'paymentMethod') > 80 or length(d->>'notes') > 2000 then return false; end if;
  foreach k in array array['startDate','nextRenewal','trialEnd','paidThrough','canceledAt'] loop
    if d->>k is not null then
      if (d->>k) !~ '^\d{4}-\d{2}-\d{2}$' or (d->>k)::date::text <> d->>k then return false; end if;
    end if;
  end loop;
  if d->>'status' = 'trial' and d->>'trialEnd' is null then return false; end if;
  if d->'reminders' is not null and d->'reminders' <> 'null'::jsonb then
    if jsonb_typeof(d->'reminders'->'enabled') <> 'boolean' or jsonb_typeof(d->'reminders'->'days') <> 'array' then return false; end if;
    if jsonb_array_length(d->'reminders'->'days') > 10 or exists(select 1 from jsonb_array_elements_text(d->'reminders'->'days') v where v !~ '^\d{1,2}$' or v::int > 30) then return false; end if;
  end if;
  return true;
exception when others then return false;
end $$;
