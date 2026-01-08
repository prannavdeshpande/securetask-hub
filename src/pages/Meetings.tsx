import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Calendar, Clock, Users, FileText, ChevronRight, Copy, UserCheck, Video } from 'lucide-react';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  duration_minutes: number;
  created_by: string;
  created_at: string;
  mom_taker?: string | null;
  participants?: { user_id: string; attended: boolean; profiles?: { full_name: string | null; email: string } }[];
  minutes?: { id: string; content: string; recorded_by: string; created_at: string; recorder?: { full_name: string | null; email: string } }[];
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

const Meetings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMinutesDialog, setShowMinutesDialog] = useState(false);
  const [newMinutes, setNewMinutes] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Form state for new meeting
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    meeting_date: '',
    meeting_time: '',
    duration_minutes: 60,
    participants: [] as string[],
    mom_taker: 'none',
  });

  useEffect(() => {
    fetchMeetings();
    fetchProfiles();
  }, [user]);

  const fetchMeetings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Collect meeting IDs the user can access (creator or participant). This avoids RLS-select errors.
      const [{ data: participantRows, error: participantErr }, { data: creatorRows, error: creatorErr }] = await Promise.all([
        supabase
          .from('meeting_participants')
          .select('meeting_id')
          .eq('user_id', user.id),
        supabase
          .from('meetings')
          .select('id')
          .eq('created_by', user.id),
      ]);

      if (participantErr) throw participantErr;
      if (creatorErr) throw creatorErr;

      const accessibleIds = new Set<string>();
      (participantRows || []).forEach((row: any) => accessibleIds.add(row.meeting_id));
      (creatorRows || []).forEach((row: any) => accessibleIds.add(row.id));

      if (accessibleIds.size === 0) {
        setMeetings([]);
        setSelectedMeeting(null);
        setLoading(false);
        return;
      }

      const meetingIds = Array.from(accessibleIds);

      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*')
        .in('id', meetingIds)
        .order('meeting_date', { ascending: false });

      if (meetingsError) throw meetingsError;

      if (!meetingsData || meetingsData.length === 0) {
        setMeetings([]);
        setSelectedMeeting(null);
        setLoading(false);
        return;
      }

      const { data: participantsData, error: participantsError } = await supabase
        .from('meeting_participants')
        .select('meeting_id, user_id, attended, profiles:profiles!meeting_participants_user_id_fkey(full_name, email)')
        .in('meeting_id', meetingIds);

      if (participantsError) throw participantsError;

      const { data: minutesData, error: minutesError } = await supabase
        .from('meeting_minutes')
        .select('id, meeting_id, content, recorded_by, created_at, profiles:profiles!meeting_minutes_recorded_by_fkey(full_name, email)')
        .in('meeting_id', meetingIds)
        .order('created_at', { ascending: false });

      if (minutesError) throw minutesError;

      const formattedMeetings = meetingsData.map((meeting: any) => ({
        ...meeting,
        participants: participantsData
          ?.filter((p) => p.meeting_id === meeting.id)
          .map((p: any) => ({
            user_id: p.user_id,
            attended: p.attended,
            profiles: p.profiles,
          })) || [],
        minutes: (minutesData?.filter((m) => m.meeting_id === meeting.id) || []).map((m: any) => ({
          ...m,
          recorder: m.profiles,
        })).sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }));

      setMeetings(formattedMeetings);

      // Keep selection in sync: if previously selected is gone, reset; else pick newest if none.
      if (formattedMeetings.length > 0) {
        const stillExists = formattedMeetings.find(m => m.id === selectedMeeting?.id);
        setSelectedMeeting(stillExists || formattedMeetings[0]);
      } else {
        setSelectedMeeting(null);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast({ title: 'Error', description: 'Failed to load meetings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleCreateMeeting = async () => {
    if (!user || !newMeeting.title || !newMeeting.meeting_date || !newMeeting.meeting_time) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const dateTimeString = `${newMeeting.meeting_date}T${newMeeting.meeting_time}`;
      const meetingDateTime = new Date(dateTimeString);
      
      if (isNaN(meetingDateTime.getTime())) {
        throw new Error('Invalid date or time');
      }

      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          title: newMeeting.title,
          description: newMeeting.description || null,
          meeting_date: meetingDateTime.toISOString(),
          duration_minutes: newMeeting.duration_minutes,
          created_by: user.id,
          mom_taker: newMeeting.mom_taker === 'none' ? null : newMeeting.mom_taker,
        })
        .select()
        .single();

      if (error) throw error;

      // Add participants including creator
      const participantsToAdd = [...new Set([...newMeeting.participants, user.id])];

      if (participantsToAdd.length > 0 && meeting) {
        const participantInserts = participantsToAdd.map((userId) => ({
          meeting_id: meeting.id,
          user_id: userId,
        }));

        const { error: participantError } = await supabase
          .from('meeting_participants')
          .insert(participantInserts);
          
        if (participantError) {
          console.error('Error adding participants:', participantError);
          toast({ title: 'Warning', description: 'Meeting created but failed to add some participants', variant: 'destructive' });
        }
      }

      toast({ title: 'Success', description: 'Meeting created successfully' });
      setShowCreateDialog(false);
      setNewMeeting({
        title: '',
        description: '',
        meeting_date: '',
        meeting_time: '',
        duration_minutes: 60,
        participants: [],
        mom_taker: 'none',
      });
      // Immediately reflect new meeting and select it
      if (meeting) {
        await fetchMeetings();
        setSelectedMeeting(meeting);
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({ title: 'Error', description: 'Failed to create meeting', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleAddMinutes = async () => {
    if (!user || !selectedMeeting || !newMinutes.trim()) {
      toast({ title: 'Error', description: 'Please enter meeting minutes', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('meeting_minutes').insert({
        meeting_id: selectedMeeting.id,
        content: newMinutes.trim(),
        recorded_by: user.id,
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Minutes added successfully' });
      setNewMinutes('');
      setShowMinutesDialog(false);
      fetchMeetings();
    } catch (error) {
      console.error('Error adding minutes:', error);
      toast({ title: 'Error', description: 'Failed to add minutes', variant: 'destructive' });
    }
  };

  const copyMeetingId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: 'Copied', description: 'Meeting ID copied to clipboard' });
  };

  const openVideoCall = (meetingId: string) => {
    const room = `taskflow-${meetingId}`;
    const url = `https://meet.jit.si/${encodeURIComponent(room)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isPastMeeting = (date: string) => new Date(date) < new Date();

  const upcomingMeetings = meetings.filter(m => !isPastMeeting(m.meeting_date));
  const pastMeetings = meetings.filter(m => isPastMeeting(m.meeting_date));

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    return (email?.trim()?.[0] || 'U').toUpperCase();
  };

  const displayedMeetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Meetings</h1>
            <p className="text-muted-foreground">View and manage your meetings and minutes</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Meeting</DialogTitle>
                <DialogDescription>Schedule a new meeting with participants</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Meeting title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newMeeting.description}
                    onChange={(e) => setNewMeeting((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Meeting description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newMeeting.meeting_date}
                      onChange={(e) => setNewMeeting((prev) => ({ ...prev, meeting_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time *</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newMeeting.meeting_time}
                      onChange={(e) => setNewMeeting((prev) => ({ ...prev, meeting_time: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Select
                    value={String(newMeeting.duration_minutes)}
                    onValueChange={(val) => setNewMeeting((prev) => ({ ...prev, duration_minutes: parseInt(val) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Participants</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[80px] bg-muted/30">
                    {profiles.filter(p => p.id !== user?.id).map((profile) => (
                      <Badge
                        key={profile.id}
                        variant={newMeeting.participants.includes(profile.id) ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        onClick={() => {
                          setNewMeeting((prev) => ({
                            ...prev,
                            participants: prev.participants.includes(profile.id)
                              ? prev.participants.filter((id) => id !== profile.id)
                              : [...prev.participants, profile.id],
                          }));
                        }}
                      >
                        {profile.full_name || profile.email}
                      </Badge>
                    ))}
                    {profiles.filter(p => p.id !== user?.id).length === 0 && (
                      <span className="text-muted-foreground text-sm">No other users available</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>MoM Note Taker (Optional)</Label>
                  <Select
                    value={newMeeting.mom_taker}
                    onValueChange={(val) => setNewMeeting((prev) => ({ ...prev, mom_taker: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select person to take notes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No one assigned</SelectItem>
                      {[...newMeeting.participants, user?.id].filter(Boolean).map((userId) => {
                        const profile = profiles.find(p => p.id === userId);
                        if (!profile) return null;
                        return (
                          <SelectItem key={userId} value={userId!}>
                            {profile.full_name || profile.email}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMeeting} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Meeting
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Meeting List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader className="pb-3">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upcoming' | 'past')}>
                    <TabsList className="w-full">
                      <TabsTrigger value="upcoming" className="flex-1">
                        Upcoming ({upcomingMeetings.length})
                      </TabsTrigger>
                      <TabsTrigger value="past" className="flex-1">
                        Past ({pastMeetings.length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {displayedMeetings.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No {activeTab} meetings</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {displayedMeetings.map((meeting) => (
                          <div
                            key={meeting.id}
                            onClick={() => setSelectedMeeting(meeting)}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                              selectedMeeting?.id === meeting.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{meeting.title}</h4>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>{format(new Date(meeting.meeting_date), 'MMM d, yyyy')}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{format(new Date(meeting.meeting_date), 'h:mm a')} • {meeting.duration_minutes}min</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex -space-x-2">
                                    {meeting.participants?.slice(0, 3).map((p) => (
                                      <Avatar key={p.user_id} className="h-6 w-6 border-2 border-background">
                                        <AvatarFallback className="text-[10px] bg-muted">
                                          {getInitials(p.profiles?.full_name || null, p.profiles?.email || '')}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))}
                                    {(meeting.participants?.length || 0) > 3 && (
                                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border-2 border-background">
                                        +{(meeting.participants?.length || 0) - 3}
                                      </div>
                                    )}
                                  </div>
                                  {meeting.minutes && meeting.minutes.length > 0 && (
                                    <Badge variant="outline" className="text-xs ml-auto">
                                      <FileText className="h-3 w-3 mr-1" />
                                      {meeting.minutes.length}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Meeting Details */}
            <div className="lg:col-span-2">
              {selectedMeeting ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl">{selectedMeeting.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {format(new Date(selectedMeeting.meeting_date), 'EEEE, MMMM d, yyyy')} at{' '}
                            {format(new Date(selectedMeeting.meeting_date), 'h:mm a')}
                          </CardDescription>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              ID: {selectedMeeting.id.slice(0, 8)}...
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyMeetingId(selectedMeeting.id)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openVideoCall(selectedMeeting.id)}
                          >
                            <Video className="h-4 w-4 mr-2" />
                            Video Call
                          </Button>

                          {isPastMeeting(selectedMeeting.meeting_date) ? (
                            <Badge variant="secondary">Past</Badge>
                          ) : (
                            <Badge variant="default">Upcoming</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedMeeting.description && (
                        <div>
                          <h4 className="font-medium mb-1 text-sm">Description</h4>
                          <p className="text-muted-foreground text-sm">{selectedMeeting.description}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMeeting.duration_minutes} minutes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedMeeting.participants?.length || 0} participants</span>
                        </div>
                      </div>
                      
                      {/* Participants section */}
                      <div>
                        <h4 className="font-medium mb-3 text-sm">Participants</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedMeeting.participants?.map((p) => (
                            <div
                              key={p.user_id}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(p.profiles?.full_name || null, p.profiles?.email || '')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {p.profiles?.full_name || p.profiles?.email || 'Unknown'}
                                </p>
                                {p.attended && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                                    <UserCheck className="h-2 w-2 mr-0.5" /> Attended
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Meeting Minutes */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Meeting Minutes (MoM)</CardTitle>
                        <CardDescription>Notes and key points from this meeting</CardDescription>
                      </div>
                      <Dialog open={showMinutesDialog} onOpenChange={setShowMinutesDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Add Notes
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Meeting Minutes</DialogTitle>
                            <DialogDescription>Record notes from {selectedMeeting.title}</DialogDescription>
                          </DialogHeader>
                          <Textarea
                            value={newMinutes}
                            onChange={(e) => setNewMinutes(e.target.value)}
                            placeholder="Enter meeting notes, action items, decisions made..."
                            className="min-h-[200px]"
                          />
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowMinutesDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddMinutes}>Save Minutes</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      {selectedMeeting.minutes && selectedMeeting.minutes.length > 0 ? (
                        <div className="space-y-4">
                          {selectedMeeting.minutes.map((minute: any) => (
                            <div key={minute.id} className="p-4 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px]">
                                    {getInitials(minute.recorder?.full_name || null, minute.recorder?.email || '')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium">
                                  {minute.recorder?.full_name || minute.recorder?.email || 'Unknown'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  • {format(new Date(minute.created_at), 'MMM d, yyyy h:mm a')}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm">{minute.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No minutes recorded yet</p>
                          <p className="text-sm mt-1">Click "Add Notes" to record meeting minutes</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="h-full min-h-[400px] flex items-center justify-center">
                  <CardContent className="text-center text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">Select a meeting to view details</p>
                    <p className="text-sm">Choose from the list on the left</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Meetings;
