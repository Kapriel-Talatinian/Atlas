ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS profile_completion INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.client_notification_preferences (
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE PRIMARY KEY,
  project_started BOOLEAN DEFAULT true,
  project_completed BOOLEAN DEFAULT true,
  quality_alert BOOLEAN DEFAULT true,
  invoice_issued BOOLEAN DEFAULT true,
  payment_reminder BOOLEAN DEFAULT true,
  payment_confirmed BOOLEAN DEFAULT true,
  export_ready BOOLEAN DEFAULT true,
  task_flagged BOOLEAN DEFAULT false,
  product_updates BOOLEAN DEFAULT false,
  new_features BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_read_own_notif_prefs" ON public.client_notification_preferences
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "clients_update_own_notif_prefs" ON public.client_notification_preferences
  FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "clients_insert_own_notif_prefs" ON public.client_notification_preferences
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));