-- Track long-running bulk report processing runs
CREATE TABLE IF NOT EXISTS public.bulk_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  total_reports integer NOT NULL DEFAULT 0,
  processed_reports integer NOT NULL DEFAULT 0,
  mapped_count integer NOT NULL DEFAULT 0,
  unmatched_count integer NOT NULL DEFAULT 0,
  needs_review_count integer NOT NULL DEFAULT 0,
  error_message text NULL,
  last_event text NULL
);

ALTER TABLE public.bulk_report_runs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage/view runs
CREATE POLICY "Admins can manage bulk report runs"
ON public.bulk_report_runs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.bulk_report_runs_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_bulk_report_runs_updated_at ON public.bulk_report_runs;
CREATE TRIGGER set_bulk_report_runs_updated_at
BEFORE UPDATE ON public.bulk_report_runs
FOR EACH ROW
EXECUTE FUNCTION public.bulk_report_runs_set_updated_at();

-- Realtime support
ALTER TABLE public.bulk_report_runs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_report_runs;