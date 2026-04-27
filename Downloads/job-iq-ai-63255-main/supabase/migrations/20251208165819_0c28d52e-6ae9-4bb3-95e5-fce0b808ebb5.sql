-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications (via service role)
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to notify on new job offers
CREATE OR REPLACE FUNCTION public.notify_new_job_offer()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for all experts
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT 
    ep.user_id,
    'Nouvelle offre d''emploi',
    'Une nouvelle offre "' || NEW.title || '" correspond à votre profil',
    'job',
    '/expert/jobs/' || NEW.id
  FROM public.expert_profiles ep
  WHERE ep.onboarding_completed = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new job offers
CREATE TRIGGER on_new_job_offer
AFTER INSERT ON public.job_offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_job_offer();

-- Create function to notify on application status change
CREATE OR REPLACE FUNCTION public.notify_application_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
      ep.user_id,
      'Mise à jour de candidature',
      CASE NEW.status
        WHEN 'accepted' THEN 'Félicitations ! Votre candidature a été acceptée'
        WHEN 'rejected' THEN 'Votre candidature n''a pas été retenue'
        WHEN 'interview' THEN 'Vous êtes invité à un entretien'
        WHEN 'reviewing' THEN 'Votre candidature est en cours d''examen'
        ELSE 'Le statut de votre candidature a changé'
      END,
      CASE NEW.status
        WHEN 'accepted' THEN 'success'
        WHEN 'rejected' THEN 'error'
        WHEN 'interview' THEN 'interview'
        ELSE 'info'
      END,
      '/expert/applications'
    FROM public.expert_profiles ep
    WHERE ep.id = NEW.expert_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for application updates
CREATE TRIGGER on_application_update
AFTER UPDATE ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_application_update();