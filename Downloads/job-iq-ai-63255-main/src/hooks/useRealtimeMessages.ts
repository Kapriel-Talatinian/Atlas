import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useRealtimeMessages = (conversationId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  const sendMessage = useCallback(async (content: string, targetConversationId?: string) => {
    const convId = targetConversationId || conversationId;
    if (!convId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation's last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', convId);

      return data as Message;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }, [conversationId]);

  const markAsRead = useCallback(async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, is_read: true } : m)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, []);

  const markConversationAsRead = useCallback(async (convId?: string) => {
    const targetConvId = convId || conversationId;
    if (!targetConvId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', targetConvId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }, [conversationId, fetchUnreadCount]);

  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();

    // Setup realtime subscription for messages
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const channelName = conversationId 
        ? `messages-${conversationId}`
        : 'all-messages';

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {})
          },
          (payload) => {
            const newMessage = payload.new as Message;
            
            // Only add to messages if we're in the right conversation
            if (!conversationId || newMessage.conversation_id === conversationId) {
              setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
              });
            }

            // Update unread count if message is from someone else
            if (newMessage.sender_id !== user.id) {
              setUnreadCount(prev => prev + 1);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {})
          },
          (payload) => {
            const updatedMessage = payload.new as Message;
            setMessages(prev =>
              prev.map(m => m.id === updatedMessage.id ? updatedMessage : m)
            );
          }
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    setupRealtimeSubscription().then(ch => {
      channel = ch;
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [conversationId, fetchMessages, fetchUnreadCount]);

  return {
    messages,
    loading,
    unreadCount,
    sendMessage,
    markAsRead,
    markConversationAsRead,
    refetch: fetchMessages
  };
};
