SELECT cron.unschedule('external-api-dispatch-every-minute');
SELECT cron.schedule(
  'external-api-dispatch-every-minute',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://fyssbzgmhnolazjfwafm.supabase.co/functions/v1/external-api-dispatch',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5c3NiemdtaG5vbGF6amZ3YWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzUyNzMsImV4cCI6MjA4MTY1MTI3M30.kEAHMjPX_eSYnjJnKnjYavagfCzpV8YbmdXqkbKPhFM"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );$$
);