-- Hosted Supabase only. Run AFTER deploying functions and adding Vault secrets.
-- Enable the pg_cron/pg_net extensions in the dashboard first. See docs/SETUP.md.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Required Vault secret names: subloom_project_url and subloom_cron_secret.
-- Their values are https://<project-ref>.supabase.co and the same CRON_SECRET
-- deployed to Edge Functions. Never put these values in Git or mobile env vars.
do $$
declare job record;
begin
  for job in select jobid from cron.job where jobname in ('subloom-schedule','subloom-deliver','subloom-retention') loop
    perform cron.unschedule(job.jobid);
  end loop;
end $$;
select cron.schedule('subloom-schedule','* * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='subloom_project_url') || '/functions/v1/schedule-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='subloom_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
select cron.schedule('subloom-deliver','* * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='subloom_project_url') || '/functions/v1/send-reminder',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='subloom_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
select cron.schedule('subloom-retention','17 3 * * *','select public.purge_retained_metadata();');
