import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Lock, CalendarIcon } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

interface TaskAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const TaskAssignmentDialog = ({ open, onOpenChange, onSuccess }: TaskAssignmentDialogProps) => {
  const { toast } = useToast();
  const { createNotification } = useNotifications();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'single' | 'all'>('single');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    is_private: false,
    deadline: null as Date | null,
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (assignmentType === 'single' && !selectedUserId) {
      toast({
        title: 'No user selected',
        description: 'Please select a user to assign the task to',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const targetUserIds = assignmentType === 'all' 
        ? users.map(u => u.id)
        : [selectedUserId];

      const tasks = targetUserIds.map(userId => ({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        is_private: formData.is_private,
        deadline: formData.deadline?.toISOString() || null,
        user_id: userId,
      }));

      const { data: insertedTasks, error } = await supabase
        .from('tasks')
        .insert(tasks)
        .select();

      if (error) throw error;

      // Create notifications for assigned users
      for (const userId of targetUserIds) {
        const taskId = insertedTasks?.find(t => t.user_id === userId)?.id;
        await createNotification(
          userId,
          'New Task Assigned',
          `You have been assigned a new task: "${formData.title}"`,
          'task_assigned',
          taskId
        );
      }

      toast({
        title: 'Task(s) assigned successfully',
        description: assignmentType === 'all' 
          ? `Task assigned to all ${targetUserIds.length} users`
          : 'Task assigned to selected user',
      });

      setFormData({ title: '', description: '', priority: 'medium', status: 'pending', is_private: false, deadline: null });
      setSelectedUserId('');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign task',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign New Task</DialogTitle>
          <DialogDescription>
            Create and assign a task to a specific user or all users
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Assignment Type</Label>
            <Select value={assignmentType} onValueChange={(value: 'single' | 'all') => setAssignmentType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Assign to specific user</SelectItem>
                <SelectItem value="all">Assign to all users</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignmentType === 'single' && (
            <div className="space-y-2">
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline Picker */}
          <div className="space-y-2">
            <Label>Deadline (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.deadline && "text-muted-foreground"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.deadline ? format(formData.deadline, "PPP p") : <span>Pick a deadline</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.deadline || undefined}
                  onSelect={(date) => setFormData({ ...formData, deadline: date || null })}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
                <div className="p-3 border-t">
                  <Label className="text-sm">Time</Label>
                  <Input
                    type="time"
                    value={formData.deadline ? format(formData.deadline, "HH:mm") : ""}
                    onChange={(e) => {
                      if (formData.deadline && e.target.value) {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(formData.deadline);
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setFormData({ ...formData, deadline: newDate });
                      }
                    }}
                    className="mt-1"
                  />
                </div>
              </PopoverContent>
            </Popover>
            {formData.deadline && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData({ ...formData, deadline: null })}
                className="text-muted-foreground"
              >
                Clear deadline
              </Button>
            )}
          </div>

          {/* Private Task Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_private_assign"
              checked={formData.is_private}
              onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked === true })}
              disabled={isLoading}
            />
            <Label htmlFor="is_private_assign" className="flex items-center gap-2 cursor-pointer">
              <Lock className="h-4 w-4" />
              Private Task (only visible to assigned user)
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
