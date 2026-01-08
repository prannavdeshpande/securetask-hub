import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Clock, User, Save } from 'lucide-react';

interface UserAvailability {
  id?: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Availability = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myAvailability, setMyAvailability] = useState<UserAvailability[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserAvailability, setSelectedUserAvailability] = useState<UserAvailability[]>([]);

  useEffect(() => {
    if (user) {
      fetchMyAvailability();
      fetchProfiles();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserAvailability(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchMyAvailability = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');

      if (error) throw error;

      // Initialize availability for all days if not set
      const availabilityMap = new Map(data?.map((a) => [a.day_of_week, a]));
      const fullAvailability = DAYS.map((_, index) => {
        const existing = availabilityMap.get(index);
        return (
          existing || {
            user_id: user.id,
            day_of_week: index,
            start_time: '09:00',
            end_time: '17:00',
            is_available: index > 0 && index < 6, // Mon-Fri by default
          }
        );
      });

      setMyAvailability(fullAvailability);
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast({ title: 'Error', description: 'Failed to load your availability', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .neq('id', user.id);
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchUserAvailability = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', userId)
        .order('day_of_week');

      if (error) throw error;
      setSelectedUserAvailability(data || []);
    } catch (error) {
      console.error('Error fetching user availability:', error);
    }
  };

  const handleSaveAvailability = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Upsert all availability records
      for (const availability of myAvailability) {
        const { error } = await supabase.from('user_availability').upsert(
          {
            user_id: user.id,
            day_of_week: availability.day_of_week,
            start_time: availability.start_time,
            end_time: availability.end_time,
            is_available: availability.is_available,
          },
          { onConflict: 'user_id,day_of_week' }
        );
        if (error) throw error;
      }

      toast({ title: 'Success', description: 'Your availability has been saved' });
    } catch (error) {
      console.error('Error saving availability:', error);
      toast({ title: 'Error', description: 'Failed to save availability', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateAvailability = (dayIndex: number, field: keyof UserAvailability, value: string | boolean) => {
    setMyAvailability((prev) =>
      prev.map((a) => (a.day_of_week === dayIndex ? { ...a, [field]: value } : a))
    );
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

  const getAvailabilityForDay = (dayIndex: number): UserAvailability | undefined => {
    return selectedUserAvailability.find((a) => a.day_of_week === dayIndex);
  };

  const selectedProfile = profiles.find((p) => p.id === selectedUserId);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Availability</h1>
          <p className="text-muted-foreground">Manage your availability and view others' schedules</p>
        </div>

        <Tabs defaultValue="my-availability" className="space-y-6">
          <TabsList>
            <TabsTrigger value="my-availability">My Availability</TabsTrigger>
            <TabsTrigger value="team-availability">Team Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="my-availability">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Weekly Schedule</CardTitle>
                  <CardDescription>Set your available hours for each day of the week</CardDescription>
                </div>
                <Button onClick={handleSaveAvailability} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myAvailability.map((availability) => (
                      <div
                        key={availability.day_of_week}
                        className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border ${
                          availability.is_available ? 'bg-card' : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between sm:w-40">
                          <span className="font-medium">{DAYS[availability.day_of_week]}</span>
                          <Switch
                            checked={availability.is_available}
                            onCheckedChange={(checked) =>
                              updateAvailability(availability.day_of_week, 'is_available', checked)
                            }
                          />
                        </div>
                        {availability.is_available && (
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground">From</Label>
                              <Input
                                type="time"
                                value={availability.start_time}
                                onChange={(e) =>
                                  updateAvailability(availability.day_of_week, 'start_time', e.target.value)
                                }
                                className="w-32"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground">To</Label>
                              <Input
                                type="time"
                                value={availability.end_time}
                                onChange={(e) =>
                                  updateAvailability(availability.day_of_week, 'end_time', e.target.value)
                                }
                                className="w-32"
                              />
                            </div>
                          </div>
                        )}
                        {!availability.is_available && (
                          <span className="text-muted-foreground text-sm">Not available</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team-availability">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Members</CardTitle>
                  <CardDescription>Select a user to view their availability</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {profiles.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <User className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No team members found</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {profiles.map((profile) => (
                          <div
                            key={profile.id}
                            onClick={() => setSelectedUserId(profile.id)}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                              selectedUserId === profile.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                            }`}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-muted">
                                {getInitials(profile.full_name, profile.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {profile.full_name || profile.email.split('@')[0]}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Availability Calendar */}
              <div className="lg:col-span-2">
                {selectedUserId && selectedProfile ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(selectedProfile.full_name, selectedProfile.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle>{selectedProfile.full_name || selectedProfile.email}</CardTitle>
                          <CardDescription>Weekly availability</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {selectedUserAvailability.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Calendar className="h-16 w-16 mx-auto mb-4 opacity-20" />
                          <p>This user hasn't set their availability yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {DAYS.map((day, index) => {
                            const availability = getAvailabilityForDay(index);
                            const isAvailable = availability?.is_available;

                            return (
                              <div
                                key={index}
                                className={`flex items-center justify-between p-4 rounded-lg border ${
                                  isAvailable ? 'bg-green-500/10 border-green-500/20' : 'bg-muted/50'
                                }`}
                              >
                                <span className="font-medium">{day}</span>
                                {isAvailable && availability ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span>
                                      {availability.start_time} - {availability.end_time}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Not available</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-full min-h-[400px] flex items-center justify-center">
                    <CardContent className="text-center text-muted-foreground">
                      <Calendar className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg">Select a team member</p>
                      <p className="text-sm">Choose from the list to view their availability</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Availability;
