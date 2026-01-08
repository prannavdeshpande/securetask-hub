import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Globe, CalendarDays, X, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface WorldClock {
  city: string;
  timezone: string;
  country: string;
}

// Extended list of cities/countries with their timezones
const availableTimezones: WorldClock[] = [
  { city: 'New York', timezone: 'America/New_York', country: 'USA' },
  { city: 'Los Angeles', timezone: 'America/Los_Angeles', country: 'USA' },
  { city: 'Chicago', timezone: 'America/Chicago', country: 'USA' },
  { city: 'London', timezone: 'Europe/London', country: 'UK' },
  { city: 'Paris', timezone: 'Europe/Paris', country: 'France' },
  { city: 'Berlin', timezone: 'Europe/Berlin', country: 'Germany' },
  { city: 'Tokyo', timezone: 'Asia/Tokyo', country: 'Japan' },
  { city: 'Sydney', timezone: 'Australia/Sydney', country: 'Australia' },
  { city: 'Dubai', timezone: 'Asia/Dubai', country: 'UAE' },
  { city: 'Singapore', timezone: 'Asia/Singapore', country: 'Singapore' },
  { city: 'Hong Kong', timezone: 'Asia/Hong_Kong', country: 'Hong Kong' },
  { city: 'Mumbai', timezone: 'Asia/Kolkata', country: 'India' },
  { city: 'Delhi', timezone: 'Asia/Kolkata', country: 'India' },
  { city: 'Shanghai', timezone: 'Asia/Shanghai', country: 'China' },
  { city: 'Beijing', timezone: 'Asia/Shanghai', country: 'China' },
  { city: 'Moscow', timezone: 'Europe/Moscow', country: 'Russia' },
  { city: 'São Paulo', timezone: 'America/Sao_Paulo', country: 'Brazil' },
  { city: 'Toronto', timezone: 'America/Toronto', country: 'Canada' },
  { city: 'Vancouver', timezone: 'America/Vancouver', country: 'Canada' },
  { city: 'Seoul', timezone: 'Asia/Seoul', country: 'South Korea' },
  { city: 'Bangkok', timezone: 'Asia/Bangkok', country: 'Thailand' },
  { city: 'Jakarta', timezone: 'Asia/Jakarta', country: 'Indonesia' },
  { city: 'Cairo', timezone: 'Africa/Cairo', country: 'Egypt' },
  { city: 'Istanbul', timezone: 'Europe/Istanbul', country: 'Turkey' },
  { city: 'Amsterdam', timezone: 'Europe/Amsterdam', country: 'Netherlands' },
  { city: 'Madrid', timezone: 'Europe/Madrid', country: 'Spain' },
  { city: 'Rome', timezone: 'Europe/Rome', country: 'Italy' },
  { city: 'Zurich', timezone: 'Europe/Zurich', country: 'Switzerland' },
  { city: 'Stockholm', timezone: 'Europe/Stockholm', country: 'Sweden' },
  { city: 'Oslo', timezone: 'Europe/Oslo', country: 'Norway' },
];

const STORAGE_KEY = 'user_world_clocks';

export const ClockCalendarWidget = () => {
  const [localTime, setLocalTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [userClocks, setUserClocks] = useState<WorldClock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Load saved clocks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUserClocks(JSON.parse(saved));
      } catch {
        setUserClocks([]);
      }
    }
  }, []);

  // Save clocks to localStorage when changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userClocks));
  }, [userClocks]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date, timezone?: string) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };
    
    if (timezone) {
      options.timeZone = timezone;
    }
    
    return date.toLocaleTimeString('en-US', options);
  };

  const formatDate = (date: Date, timezone?: string) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };
    
    if (timezone) {
      options.timeZone = timezone;
    }
    
    return date.toLocaleDateString('en-US', options);
  };

  const filteredTimezones = availableTimezones.filter(
    (tz) =>
      !userClocks.some((c) => c.timezone === tz.timezone) &&
      (tz.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tz.country.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addClock = (clock: WorldClock) => {
    setUserClocks((prev) => [...prev, clock]);
    setSearchQuery('');
    setShowSearch(false);
  };

  const removeClock = (timezone: string) => {
    setUserClocks((prev) => prev.filter((c) => c.timezone !== timezone));
  };

  return (
    <Card className="w-full overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-full bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          Clock & Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="local" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger 
              value="local" 
              className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
            >
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Local
            </TabsTrigger>
            <TabsTrigger 
              value="world" 
              className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
            >
              <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              World
            </TabsTrigger>
            <TabsTrigger 
              value="calendar" 
              className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
            >
              <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="mt-4">
            <div className="text-center space-y-4 py-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 blur-3xl -z-10" />
                <div className="text-5xl sm:text-6xl font-bold font-mono bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent animate-pulse">
                  {formatTime(localTime)}
                </div>
              </div>
              <div className="text-xl font-medium text-foreground">
                {formatDate(localTime)}
              </div>
              <Badge variant="secondary" className="text-sm px-4 py-1">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </Badge>
            </div>
          </TabsContent>

          <TabsContent value="world" className="mt-4">
            <div className="space-y-3">
              {/* Add Clock Section */}
              <div className="mb-4">
                {showSearch ? (
                  <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search city or country..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowSearch(false);
                          setSearchQuery('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {searchQuery && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filteredTimezones.slice(0, 5).map((tz) => (
                          <button
                            key={tz.timezone + tz.city}
                            onClick={() => addClock(tz)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors flex justify-between items-center"
                          >
                            <span className="font-medium">{tz.city}</span>
                            <span className="text-sm text-muted-foreground">{tz.country}</span>
                          </button>
                        ))}
                        {filteredTimezones.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            No matching cities found
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSearch(true)}
                    className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add World Clock
                  </Button>
                )}
              </div>

              {/* User's World Clocks */}
              {userClocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No world clocks added yet</p>
                  <p className="text-xs">Click "Add World Clock" to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userClocks.map((clock) => (
                    <div
                      key={clock.timezone + clock.city}
                      className="group flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 hover:from-primary/10 hover:to-primary/5 transition-all duration-300 border border-transparent hover:border-primary/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Globe className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{clock.city}</div>
                          <div className="text-xs text-muted-foreground">{clock.country}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono text-lg font-bold text-primary">
                            {formatTime(localTime, clock.timezone)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(localTime, clock.timezone)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeClock(clock.timezone)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-lg pointer-events-auto [&_.rdp-day_button]:rounded-lg [&_.rdp-day_button.rdp-day_selected]:bg-primary [&_.rdp-day_button.rdp-day_selected]:text-primary-foreground"
                />
                {selectedDate && (
                  <div className="mt-4 text-center">
                    <Badge variant="secondary" className="text-sm px-4 py-1">
                      Selected: {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
