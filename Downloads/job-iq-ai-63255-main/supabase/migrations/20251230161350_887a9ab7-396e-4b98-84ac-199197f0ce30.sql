-- Create expert_availability table for calendar
CREATE TABLE public.expert_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.expert_profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  availability_type TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_availability_type CHECK (availability_type IN ('available', 'unavailable', 'partial', 'booked'))
);

-- Enable RLS
ALTER TABLE public.expert_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Experts can view their own availability"
ON public.expert_availability FOR SELECT
USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can create their own availability"
ON public.expert_availability FOR INSERT
WITH CHECK (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can update their own availability"
ON public.expert_availability FOR UPDATE
USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Experts can delete their own availability"
ON public.expert_availability FOR DELETE
USING (expert_id IN (SELECT id FROM public.expert_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all availability"
ON public.expert_availability FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Companies can view expert availability"
ON public.expert_availability FOR SELECT
USING (has_role(auth.uid(), 'company'::app_role) AND availability_type = 'available');

-- Trigger for updated_at
CREATE TRIGGER update_expert_availability_updated_at
BEFORE UPDATE ON public.expert_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create conversations table for messaging
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_1_id UUID NOT NULL,
  participant_2_id UUID NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT different_participants CHECK (participant_1_id != participant_2_id)
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

CREATE POLICY "Users can update their own conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in their conversations"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE participant_1_id = auth.uid() OR participant_2_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE
USING (sender_id = auth.uid());

-- Trigger for conversations updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;