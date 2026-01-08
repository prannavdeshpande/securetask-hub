import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  expires_at?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  sender?: {
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
  };
  receiver?: {
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
  };
  reactions?: MessageReaction[];
}

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}

interface ChatUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  unread_count: number;
  is_online?: boolean;
  last_seen?: string;
  is_typing?: boolean;
  is_blocked?: boolean;
  last_message_at?: string | null;
  last_message?: string | null;
  last_message_is_read?: boolean;
  last_message_sender_id?: string | null;
}

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  is_typing_to: string | null;
}

export const useChat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileEnsured, setProfileEnsured] = useState(false);

  // Ensure user profile exists before any operations
  const ensureProfile = useCallback(async () => {
    if (!user || profileEnsured) return true;

    try {
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking profile:', checkError);
        return false;
      }

      // If profile doesn't exist, create it
      if (!existingProfile) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || null,
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          return false;
        }
      }

      setProfileEnsured(true);
      return true;
    } catch (error) {
      console.error('Error ensuring profile:', error);
      return false;
    }
  }, [user, profileEnsured]);

  // Update user presence
  const updatePresence = useCallback(async (isOnline: boolean, typingTo: string | null = null) => {
    if (!user) return;

    // Ensure profile exists first
    const profileOk = await ensureProfile();
    if (!profileOk) return;

    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          is_typing_to: typingTo,
        }, { onConflict: 'user_id' });

      if (error) console.error('Error updating presence:', error);
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [user, ensureProfile]);

  // Set typing status
  const setTypingStatus = useCallback((typing: boolean) => {
    setIsTyping(typing);
    if (selectedUser) {
      updatePresence(true, typing ? selectedUser : null);
    }
  }, [selectedUser, updatePresence]);

  // Fetch blocked users
  const fetchBlockedUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (error) throw error;
      setBlockedUsers(data?.map(b => b.blocked_id) || []);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  // Update a chat user's last message locally and move them to top
  const updateChatUserLastMessage = (userId: string, message: string | null, senderId: string | null, createdAt: string | null, isRead: boolean | null) => {
    setChatUsers(prev => {
      const found = prev.find(p => p.id === userId);
      if (!found) return prev;

      const updated = prev.map(p =>
        p.id === userId
          ? {
              ...p,
              last_message: message || p.last_message,
              last_message_at: createdAt || p.last_message_at,
              last_message_is_read: typeof isRead === 'boolean' ? isRead : p.last_message_is_read,
              last_message_sender_id: senderId || p.last_message_sender_id,
            }
          : p
      );

      // sort by last_message_at desc, then unread_count, then name
      updated.sort((a, b) => {
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        if (bt !== at) return bt - at;
        const au = a.unread_count || 0;
        const bu = b.unread_count || 0;
        if (bu !== au) return bu - au;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });

      return updated;
    });
  };

  // Fetch all users for chat with presence
  const fetchChatUsers = async () => {
    if (!user) return;

    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .neq('id', user.id);

      if (profilesError) throw profilesError;

      // Get presence data
      const { data: presenceData } = await supabase
        .from('user_presence')
        .select('*');

      // Get unread counts, blocked status and last message for each user
      const usersWithData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', profile.id)
            .eq('receiver_id', user.id)
            .eq('is_read', false);

          const presence = presenceData?.find(p => p.user_id === profile.id);
          const isBlocked = blockedUsers.includes(profile.id);

          // Get the last message between the current user and this profile
          const { data: lastMsg } = await supabase
            .from('chat_messages')
            .select('id, message, created_at, sender_id, receiver_id, is_read')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...profile,
            unread_count: count || 0,
            is_online: presence?.is_online || false,
            last_seen: presence?.last_seen,
            is_typing: presence?.is_typing_to === user.id,
            is_blocked: isBlocked,
            last_message_at: lastMsg?.created_at || null,
            last_message: lastMsg?.message || null,
            last_message_is_read: lastMsg?.is_read || false,
            last_message_sender_id: lastMsg?.sender_id || null,
          };
        })
      );

      // Sort users by most recent activity (last message), then by unread count, then name
      usersWithData.sort((a, b) => {
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        if (bt !== at) return bt - at;
        const au = a.unread_count || 0;
        const bu = b.unread_count || 0;
        if (bu !== au) return bu - au;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });

      setChatUsers(usersWithData);
    } catch (error) {
      console.error('Error fetching chat users:', error);
    }
  };

  // Fetch messages with reactions
  const fetchMessages = async () => {
    if (!user || !selectedUser) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(full_name, email, avatar_url),
          receiver:profiles!chat_messages_receiver_id_fkey(full_name, email, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser}),and(sender_id.eq.${selectedUser},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filter out expired messages
      const now = new Date();
      const validMessages = (data || []).filter(msg => {
        if (!msg.expires_at) return true;
        return new Date(msg.expires_at) > now;
      });

      // Fetch reactions for all messages
      const messageIds = validMessages.map(m => m.id);
      const { data: reactions } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      const messagesWithReactions = validMessages.map(msg => ({
        ...msg,
        reactions: reactions?.filter(r => r.message_id === msg.id) || [],
      }));

      setMessages(messagesWithReactions);

      // Mark messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('sender_id', selectedUser)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      fetchChatUsers();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Upload file and return URL
  const uploadFile = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    if (!user) return null;

    // Enforce 100MB size limit at the upload layer as well
    const MAX_BYTES = 100 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast({
        title: 'File too large',
        description: 'Files must be 100MB or smaller.',
        variant: 'destructive',
      });
      return null;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      return {
        url: publicUrl,
        name: file.name,
        type: file.type,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Delete a single message by id (sender or admin)
  const deleteMessage = async (messageId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) {
        // If sender check failed (not the sender), try admin delete (requires server-side or row-level permission); for now, only allow sender to delete
        console.error('Error deleting message:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete message',
          variant: 'destructive',
        });
        return false;
      }

      // Optimistically remove message from local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast({
        title: 'Message deleted',
        description: 'The message was successfully deleted.',
      });
      return true;
    } catch (err) {
      console.error('Error deleting message:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
      return false;
    }
  };

  const forwardMessage = async (originalMessage: ChatMessage, recipientIds: string[]) => {
    if (!user) return;

    try {
      const messagesToInsert = recipientIds.map(recipientId => {
        const fileInfo = originalMessage.file_url 
            ? { 
                message: `Forwarded file: ${originalMessage.file_name}`,
                file_url: originalMessage.file_url,
                file_name: originalMessage.file_name,
                file_type: originalMessage.file_type
              }
            : {
                message: originalMessage.message ? `Forwarded: \n"${originalMessage.message}"` : 'Forwarded message',
                file_url: null,
                file_name: null,
                file_type: null
            };

        return {
          sender_id: user.id,
          receiver_id: recipientId,
          ...fileInfo,
        };
      });

      if (messagesToInsert.length === 0) return;

      const { error } = await supabase.from('chat_messages').insert(messagesToInsert);

      if (error) throw error;

      toast({
        title: 'Message Forwarded',
        description: `Successfully forwarded the message to ${recipientIds.length} user(s).`,
      });

    } catch (error) {
      console.error('Error forwarding message:', error);
      toast({
        title: 'Error',
        description: 'Failed to forward message',
        variant: 'destructive',
      });
    }
  };

  // Send a message with optional file and disappearing option
  const sendMessage = async (message: string, file?: File, expiresInMinutes?: number) => {
    if (!user || !selectedUser) return;
    if (!message.trim() && !file) return;

    // Ensure profile exists first
    const profileOk = await ensureProfile();
    if (!profileOk) {
      toast({
        title: 'Error',
        description: 'Failed to initialize your profile. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Check if user is blocked
    if (blockedUsers.includes(selectedUser)) {
      toast({
        title: 'Cannot send message',
        description: 'You have blocked this user',
        variant: 'destructive',
      });
      return;
    }

    try {
      let fileData = null;
      if (file) {
        fileData = await uploadFile(file);
      }

      const expiresAt = expiresInMinutes 
        ? new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
        : null;

      const { data: insertedMessage, error } = await supabase.from('chat_messages').insert({
        sender_id: user.id,
        receiver_id: selectedUser,
        message: message.trim() || (fileData ? `Sent a file: ${fileData.name}` : ''),
        file_url: fileData?.url || null,
        file_name: fileData?.name || null,
        file_type: fileData?.type || null,
        expires_at: expiresAt,
      }).select().maybeSingle();

      if (error) throw error;
      setTypingStatus(false);

      // Append to current conversation immediately and move conversation to top
      if (insertedMessage) {
        setMessages(prev => [...prev, { ...insertedMessage, reactions: [] }]);
        updateChatUserLastMessage(selectedUser, insertedMessage.message || null, user.id, insertedMessage.created_at || new Date().toISOString(), false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  // Add reaction to message
  const addReaction = async (messageId: string, reaction: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, reaction })
        .select('*')
        .single();

      // Ignore duplicate error (already reacted)
      if (error) {
        const code = (error as any)?.code;
        if (code === '23505') return;
        throw error;
      }

      if (data) {
        setMessages(prevMessages =>
          prevMessages.map(msg => {
            if (msg.id !== messageId) return msg;
            const existing = (msg.reactions || []).some(r => r.id === data.id);
            return existing
              ? msg
              : { ...msg, reactions: [...(msg.reactions || []), data] };
          })
        );
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast({ title: 'Error', description: 'Failed to add reaction.', variant: 'destructive' });
    }
  };

  // Remove reaction from message (by reaction id)
  const removeReaction = async (reactionId: string) => {
    if (!user) return;

    try {
      // Optimistically update UI first
      setMessages(prevMessages =>
        prevMessages.map(msg => ({
          ...msg,
          reactions: (msg.reactions || []).filter(r => r.id !== reactionId),
        }))
      );

      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', reactionId)
        .eq('user_id', user.id);

      if (error) {
        // Revert on error - refetch messages
        fetchMessages();
        throw error;
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
      toast({ title: 'Error', description: 'Failed to remove reaction.', variant: 'destructive' });
    }
  };

  // Block user
  const blockUser = async (userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user.id,
          blocked_id: userId,
        });

      if (error) throw error;
      setBlockedUsers(prev => [...prev, userId]);
      toast({
        title: 'User blocked',
        description: 'You will no longer receive messages from this user',
      });
      fetchChatUsers();
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: 'Error',
        description: 'Failed to block user',
        variant: 'destructive',
      });
    }
  };

  // Unblock user
  const unblockUser = async (userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);

      if (error) throw error;
      setBlockedUsers(prev => prev.filter(id => id !== userId));
      toast({
        title: 'User unblocked',
        description: 'You can now receive messages from this user',
      });
      fetchChatUsers();
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  // Report user
  const reportUser = async (userId: string, reason: string, details?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('reported_users')
        .insert({
          reporter_id: user.id,
          reported_id: userId,
          reason,
          details,
        });

      if (error) throw error;
      toast({
        title: 'Report submitted',
        description: 'Thank you for reporting. Our team will review this.',
      });
    } catch (error) {
      console.error('Error reporting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit report',
        variant: 'destructive',
      });
    }
  };

  // Clear chat with user
  const clearChat = async (userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`);

      if (error) throw error;
      setMessages([]);
      toast({
        title: 'Chat cleared',
        description: 'All messages have been deleted',
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear chat',
        variant: 'destructive',
      });
    }
  };

  // Subscribe to new messages and read status updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('chat_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          if (
            (newMessage.sender_id === selectedUser && newMessage.receiver_id === user.id) ||
            (newMessage.sender_id === user.id && newMessage.receiver_id === selectedUser)
          ) {
            const { data } = await supabase
              .from('chat_messages')
              .select(`
                *,
                sender:profiles!chat_messages_sender_id_fkey(full_name, email),
                receiver:profiles!chat_messages_receiver_id_fkey(full_name, email)
              `)
              .eq('id', newMessage.id)
              .maybeSingle();

            if (data) {
              setMessages((prev) => {
                // Avoid duplicating messages if we already have this id (optimistic insert + realtime insert race)
                if (prev.some(m => m.id === data.id)) return prev;
                return [...prev, { ...data, reactions: [] }];
              });

              // Update chat user last message (mark read if viewing)
              updateChatUserLastMessage(selectedUser!, data?.message || null, data?.sender_id || null, data?.created_at || new Date().toISOString(), newMessage.receiver_id === user.id ? true : null);

              if (newMessage.receiver_id === user.id) {
                await supabase
                  .from('chat_messages')
                  .update({ is_read: true })
                  .eq('id', newMessage.id);
              }
            }
          }

          // For messages that don't belong to the open conversation, move that conversation to top
          if (!(newMessage.sender_id === selectedUser && newMessage.receiver_id === user.id) && !(newMessage.sender_id === user.id && newMessage.receiver_id === selectedUser)) {
            const otherId = newMessage.sender_id === user.id ? newMessage.receiver_id : newMessage.sender_id;
            updateChatUserLastMessage(otherId, (newMessage as any).message || null, newMessage.sender_id, (newMessage as any).created_at || new Date().toISOString(), false);
          }

          fetchChatUsers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage;
          // Update read status in real-time
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id
                ? { ...msg, is_read: updatedMessage.is_read }
                : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const oldMessage = payload.old as { id: string };
          if (oldMessage && oldMessage.id) {
              setMessages((prev) => prev.filter((m) => m.id !== oldMessage.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser]);

  // Subscribe to reactions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('reactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          // Instead of fetchMessages(), update state locally
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as MessageReaction;
            setMessages(prevMessages => prevMessages.map(msg => {
              if (msg.id === newReaction.message_id) {
                // Add reaction if it doesn't exist
                if (!msg.reactions?.find(r => r.id === newReaction.id)) {
                  return { ...msg, reactions: [...(msg.reactions || []), newReaction] };
                }
              }
              return msg;
            }));
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as {id: string, message_id: string};
            setMessages(prevMessages => prevMessages.map(msg => {
              if (msg.id === oldReaction.message_id) {
                return { ...msg, reactions: (msg.reactions || []).filter(r => r.id !== oldReaction.id) };
              }
              return msg;
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser]);

  // Subscribe to presence updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('presence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          const presence = payload.new as UserPresence;
          
          // Update typing indicator
          if (selectedUser && presence.user_id === selectedUser) {
            setOtherUserTyping(presence.is_typing_to === user.id);
          }

          fetchChatUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser]);

  // Update presence on mount and cleanup
  useEffect(() => {
    if (!user) return;

    updatePresence(true);

    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat to keep presence alive
    const heartbeat = setInterval(() => {
      updatePresence(true, isTyping && selectedUser ? selectedUser : null);
    }, 30000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeat);
      updatePresence(false);
    };
  }, [user, updatePresence, isTyping, selectedUser]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [user]);

  useEffect(() => {
    fetchChatUsers();
  }, [user, blockedUsers]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedUser]);

  const totalUnread = chatUsers.reduce((sum, u) => sum + u.unread_count, 0);

  // Filter messages based on search query
  const filteredMessages = searchQuery.trim()
    ? messages.filter((msg) =>
        msg.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.file_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  return {
    messages: filteredMessages,
    allMessages: messages,
    chatUsers,
    selectedUser,
    setSelectedUser,
    sendMessage,
    loading,
    uploading,
    totalUnread,
    refreshUsers: fetchChatUsers,
    blockedUsers,
    blockUser,
    unblockUser,
    reportUser,
    clearChat,
    addReaction,
    removeReaction,
    setTypingStatus,
    otherUserTyping,
    searchQuery,
    setSearchQuery,
    deleteMessage,
    forwardMessage,
  };
};

