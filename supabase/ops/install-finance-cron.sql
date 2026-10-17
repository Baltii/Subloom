-- Deploy refresh-exchange-rates and set its CRON_SECRET first.
-- Enable pg_cron/pg_net. Reuse subloom_project_url/subloom_cron_secret in Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
declare job record;
begin
 if not exists (select 1 from vault.decrypted_secrets where name='subloom_project_url')
   or not exists (select 1 from vault.decrypted_secrets where name='subloom_cron_secret') then
   raise exception 'Configure Subloom project URL and cron secret in Vault first';
 end if;
 for job in select jobid from cron.job where jobname='subloom-exchange-rates' loop perform cron.unschedule(job.jobid); end loop;
end $$;
select cron.schedule('subloom-exchange-rates','30 17 * * *',$job$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='subloom_project_url') || '/functions/v1/refresh-exchange-rates',
   headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='subloom_cron_secret')),
   body := '{}'::jsonb, timeout_milliseconds := 60000
 );
$job$);
