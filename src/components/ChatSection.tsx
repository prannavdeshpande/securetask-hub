import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/useChat';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ImagePreviewModal } from "./ImagePreviewModal";
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageSquare, Send, ArrowLeft, Users, ExternalLink, Paperclip, X, FileIcon, Image as ImageIcon, Loader2, Copy, Trash2, Share2, MoreHorizontal, Smile, Download } from 'lucide-react';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';

export const ChatSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    messages,
    chatUsers,
    selectedUser,
    setSelectedUser,
    sendMessage,
    loading,
    uploading,
    totalUnread,
    deleteMessage,
    addReaction,
    removeReaction,
  } = useChat();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image modal state (open images only in-app, block context menu to avoid opening in new tab)
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const openImage = (url: string) => {
    setModalImageUrl(url);
    setShowImageModal(true);
  };

  // File preview modal state
  const [showFileModal, setShowFileModal] = useState(false);
  const [modalFileUrl, setModalFileUrl] = useState<string | null>(null);
  const [modalFileName, setModalFileName] = useState<string | null>(null);
  const [modalFileType, setModalFileType] = useState<string | null>(null);
  const openFile = (url: string, name?: string, type?: string) => {
    setModalFileUrl(url);
    setModalFileName(name || null);
    setModalFileType(type || null);
    setShowFileModal(true);
  };

  // Preview helper for files (PDF/office) - try blob fetch then Google Viewer fallback
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdObjectUrl: string | null = null;

    const preparePreview = async () => {
      setPreviewUrl(null);
      setPreviewError(null);
      if (!showFileModal || !modalFileUrl) return;

      const isPdf = modalFileType?.includes('pdf') || (modalFileName || '').toLowerCase().endsWith('.pdf');
      const isOffice = /(application\/msword|vnd\.openxmlformats-officedocument|application\/vnd\.ms-excel|application\/vnd\.ms-powerpoint|\.docx$|\.doc$|\.pptx$|\.ppt$|\.xlsx$|\.xls$)/i.test(modalFileType || (modalFileName || ''));

      if (isPdf) {
        try {
          const res = await fetch(modalFileUrl!);
          if (!res.ok) throw new Error('Network');
          const blob = await res.blob();
          createdObjectUrl = URL.createObjectURL(blob);
          if (!active) return;
          setPreviewUrl(createdObjectUrl);
        } catch (err) {
          const viewer = `https://docs.google.com/gview?url=${encodeURIComponent(modalFileUrl!)}&embedded=true`;
          setPreviewUrl(viewer);
          setPreviewError('Direct preview failed; using Google Docs viewer. If viewer cannot access the file, download instead.');
        }
        return;
      }

      if (isOffice) {
        const viewer = `https://docs.google.com/gview?url=${encodeURIComponent(modalFileUrl!)}&embedded=true`;
        setPreviewUrl(viewer);
        setPreviewError(null);
        return;
      }

      setPreviewUrl(null);
    };

    preparePreview();

    return () => {
      active = false;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
      setPreviewUrl(null);
      setPreviewError(null);
    };
  }, [showFileModal, modalFileUrl, modalFileName, modalFileType]);

  const downloadFile = async (url?: string, name?: string) => {
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network error');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast({ title: 'Downloaded', description: `${name || 'File'} downloaded` });
    } catch (err) {
      toast({ title: 'Download failed', description: 'Could not download file' });
    }
  }; 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() && !selectedFile) return;
    await sendMessage(newMessage, selectedFile || undefined);
    setNewMessage('');
    setSelectedFile(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX) {
        alert('File size must be 100MB or less');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const MAX = 100 * 1024 * 1024; // 100MB
          if (file.size > MAX) {
            toast({
              title: 'File too large',
              description: 'Pasted file size must be 100MB or less.',
              variant: 'destructive',
            });
            return;
          }
          setSelectedFile(file);
          break; 
        }
      }
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const selectedUserData = chatUsers.find((u) => u.id === selectedUser);

  const isImageFile = (type: string | null | undefined) => {
    return type?.startsWith('image/');
  };

  return (
    <Card className="w-full h-[500px] flex flex-col overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-full bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            {selectedUser ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                  className="p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="truncate max-w-[120px]">{selectedUserData?.full_name || selectedUserData?.email}</span>
              </div>
            ) : (
              'Messages'
            )}
          </div>
          <div className="flex items-center gap-2">
            {!selectedUser && totalUnread > 0 && (
              <Badge variant="destructive" className="rounded-full">
                {totalUnread}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/chat')}
              className="text-xs gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Full View
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {!selectedUser ? (
          // User List
          <ScrollArea className="flex-1 px-4">
            <div className="py-4 space-y-2">
              {chatUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No users available to chat</p>
                  <p className="text-xs mt-1">Other registered users will appear here</p>
                </div>
              ) : (
                chatUsers.map((chatUser) => (
                  <button
                    key={chatUser.id}
                    onClick={() => setSelectedUser(chatUser.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-all duration-200 group"
                  >
                    <Avatar className="h-10 w-10 border-2 border-primary/20 group-hover:border-primary/40 transition-colors">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                        {getInitials(chatUser.full_name, chatUser.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {chatUser.full_name || chatUser.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {chatUser.email}
                      </div>
                    </div>
                    {chatUser.unread_count > 0 && (
                      <Badge variant="destructive" className="rounded-full animate-pulse">
                        {chatUser.unread_count}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          // Chat View
          <>
            <ScrollArea className="flex-1 px-4">
              <div className="py-4 space-y-4">
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Loader2 className="animate-spin rounded-full h-8 w-8 mx-auto mb-3 text-primary" />
                    <p className="text-sm">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  (() => {
                    // Group messages by date
                    const getDateLabel = (dateStr: string) => {
                      const date = new Date(dateStr);
                      if (isToday(date)) return 'Today';
                      if (isYesterday(date)) return 'Yesterday';
                      return format(date, 'EEEE, MMMM d, yyyy');
                    };

                    let lastDateLabel = '';

                    return messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      const currentDateLabel = getDateLabel(msg.created_at);
                      const showDateDivider = currentDateLabel !== lastDateLabel;
                      lastDateLabel = currentDateLabel;

                      const handleReaction = (messageId: string, reaction: string) => {
                        const existingReaction = messages
                          .find(m => m.id === messageId)
                          ?.reactions?.find(r => r.user_id === user?.id && r.reaction === reaction);

                        if (existingReaction) {
                          removeReaction(existingReaction.id);
                        } else {
                          addReaction(messageId, reaction);
                        }
                      };

                      const reactionsSummary = (msg.reactions || []).reduce((acc, r) => {
                        acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      return (
                        <div key={msg.id}>
                          {showDateDivider && (
                            <div className="flex items-center justify-center my-4">
                              <div className="flex-1 border-t border-border" />
                              <span className="px-3 text-xs font-medium text-muted-foreground bg-card">
                                {currentDateLabel}
                              </span>
                              <div className="flex-1 border-t border-border" />
                            </div>
                          )}
                          <div
                            className={`group flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                        <div className="flex items-end gap-2 max-w-[85%]">
                          {!isOwn && (
                             <Avatar className="h-8 w-8">
                               <AvatarFallback>{getInitials(selectedUserData?.full_name || null, selectedUserData?.email || '')}</AvatarFallback>
                             </Avatar>
                          )}
                          <div
                            className={`relative flex flex-col rounded-2xl ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted rounded-bl-sm'
                            }`}
                          >
                            <div className="px-4 py-2">
                              {msg.file_url && (
                                <div className="mb-2">
                                  {isImageFile(msg.file_type) ? (
                                    <button
                                      type="button"
                                      onClick={() => openImage(msg.file_url!)}
                                      onContextMenu={(e) => e.preventDefault()}
                                      className="p-0.5 bg-transparent border-0 rounded-lg"
                                    >
                                      <img
                                        src={msg.file_url}
                                        alt={msg.file_name || 'Image'}
                                        className="max-w-full max-h-40 object-cover select-none"
                                        draggable={false}
                                        onDragStart={(e) => e.preventDefault()}
                                      />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openFile(msg.file_url!, msg.file_name, msg.file_type)}
                                      onContextMenu={(e) => e.preventDefault()}
                                      className={`flex items-center gap-2 p-2 rounded-lg ${
                                        isOwn ? 'bg-primary-foreground/10' : 'bg-background'
                                      }`}
                                    >
                                      <FileIcon className="h-4 w-4 shrink-0" />
                                      <span className="text-xs truncate">{msg.file_name}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                              {msg.message && !msg.message.startsWith('Sent a file:') && (
                                <p className="text-sm break-words">{msg.message}</p>
                              )}
                              <p
                                className={`text-xs mt-1 ${
                                  isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                }`}
                              >
                                {format(new Date(msg.created_at), 'h:mm a')}
                              </p>
                            </div>

                            {/* Reactions Display */}
                            {Object.keys(reactionsSummary).length > 0 && (
                              <div className="flex gap-1 px-2 pb-1 -mt-2">
                                {Object.entries(reactionsSummary).map(([emoji, count]) => (
                                  <Badge
                                    key={emoji}
                                    variant={isOwn ? 'secondary' : 'outline'}
                                    className="cursor-pointer"
                                    onClick={() => handleReaction(msg.id, emoji)}
                                  >
                                    {emoji} {count > 1 ? count : ''}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Hover Actions */}
                            <div className={`absolute top-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'}`}>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="icon" variant="ghost" className="p-1 h-6 w-6">
                                    <Smile className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-1">
                                  <div className="flex gap-1">
                                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                      <Button
                                        key={emoji}
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleReaction(msg.id, emoji)}
                                        className="h-8 w-8 text-lg rounded-full"
                                      >
                                        {emoji}
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="p-1 h-6 w-6">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
                                  <DropdownMenuItem onClick={async () => {
                                    if (msg.message) {
                                      await navigator.clipboard.writeText(msg.message);
                                      toast({ title: 'Copied', description: 'Message copied to clipboard' });
                                    }
                                  }}>
                                    <Copy className="mr-2 h-3.5 w-3.5" />
                                    Copy
                                  </DropdownMenuItem>
                                  {msg.file_url && (
                                    <DropdownMenuItem onClick={async () => {
                                      await navigator.clipboard.writeText(msg.file_url!);
                                      toast({ title: 'Copied', description: 'File URL copied to clipboard' });
                                    }}>
                                      <Share2 className="mr-2 h-3.5 w-3.5" />
                                      Copy file link
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {isOwn && (
                                    <DropdownMenuItem onClick={async () => {
                                      if (!confirm('Delete this message?')) return;
                                      await deleteMessage(msg.id);
                                    }} className="text-destructive">
                                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border/50 bg-muted/30">
              {selectedFile && (
                <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                  {selectedFile.type.startsWith('image/') ? (
                    <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="truncate flex-1 text-xs">{selectedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 h-9 w-9"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onPaste={handlePaste}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full bg-background border-border/50 focus-visible:ring-primary h-9"
                  disabled={uploading}
                />
                <Button
                  onClick={handleSend}
                  disabled={(!newMessage.trim() && !selectedFile) || uploading}
                  size="icon"
                  className="rounded-full shrink-0 h-9 w-9"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <ImagePreviewModal
              isOpen={showImageModal}
              onClose={() => setShowImageModal(false)}
              imageUrl={modalImageUrl}
            />

            {/* File preview modal */}
            <Dialog open={showFileModal} onOpenChange={(open) => { if (!open) { setShowFileModal(false); setModalFileUrl(null); setModalFileName(null); setModalFileType(null); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{modalFileName || 'File preview'}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[80vh]">
                  {((modalFileType && modalFileType.includes('pdf')) || (modalFileName || '').toLowerCase().endsWith('.pdf')) ? (
                    previewUrl ? (
                      <iframe src={previewUrl || ''} title={modalFileName || 'pdf'} className="w-full h-[70vh] border-none" />
                    ) : (
                      <div className="p-6 text-center">
                        <div className="mb-2">Loading preview...</div>
                        {previewError && <div className="text-sm text-muted-foreground mb-4">{previewError}</div>}
                        <div className="flex justify-center gap-2">
                          <Button onClick={() => downloadFile(modalFileUrl!, modalFileName || 'file')}>Download</Button>
                          <Button variant="outline" onClick={() => { setShowFileModal(false); setModalFileUrl(null); setModalFileName(null); setModalFileType(null); }}>Close</Button>
                        </div>
                      </div>
                    )
                  ) : modalFileType && /msword|openxmlformats-officedocument|vnd\.ms-excel|vnd\.ms-powerpoint/i.test(modalFileType || '') ? (
                    previewUrl ? (
                      <iframe src={previewUrl || ''} title={modalFileName || 'file'} className="w-full h-[70vh] border-none" />
                    ) : (
                      <div className="p-6 text-center text-sm text-muted-foreground">Preview not available</div>
                    )
                  ) : modalFileUrl ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <FileIcon className="h-8 w-8" />
                      <div className="text-sm">{modalFileName}</div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={() => downloadFile(modalFileUrl!, modalFileName || 'file')}>Download</Button>
                        <Button variant="outline" onClick={() => { setShowFileModal(false); setModalFileUrl(null); setModalFileName(null); setModalFileType(null); }}>Close</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">No preview available</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
};
