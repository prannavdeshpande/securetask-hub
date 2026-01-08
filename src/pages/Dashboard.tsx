import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Edit2, Search, Filter, User, Users, UserPlus, List, Lock, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TaskDialog } from '@/components/TaskDialog';
import { TaskAssignmentDialog } from '@/components/TaskAssignmentDialog';
import { UserListView } from '@/components/UserListView';
import { UserPerformanceView } from '@/components/UserPerformanceView';
import { ClockCalendarWidget } from '@/components/ClockCalendarWidget';
import { ChatSection } from '@/components/ChatSection';
import { AppLayout } from '@/components/AppLayout';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  user_id: string;
  is_private?: boolean;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface SelectedUser {
  userName: string;
  userEmail: string;
  userId: string;
  tasks: Task[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, isAdmin, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<'self' | 'all'>('all');
  const [showUserList, setShowUserList] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showChat, setShowChat] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    fetchTasks();
  }, []);

  // Apply filters whenever tasks or filter criteria change
  useEffect(() => {
    let result = [...tasks];

    // For admins, allow toggling between their own tasks and all users' tasks
    if (isAdmin && adminViewMode === 'self' && user) {
      result = result.filter(task => task.user_id === user.id);
    }

    // Search filter
    if (searchQuery.trim()) {
      result = result.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(task => task.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(task => task.priority === priorityFilter);
    }

    // Sort order
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    setFilteredTasks(result);
  }, [tasks, searchQuery, statusFilter, priorityFilter, sortOrder, isAdmin, adminViewMode, user]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_user_id_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Show undo toast
      toast({
        title: 'Task deleted',
        description: 'Task has been deleted successfully',
        action: (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (taskToDelete) {
                try {
                  const { error: restoreError } = await supabase
                    .from('tasks')
                    .insert({
                      id: taskToDelete.id,
                      title: taskToDelete.title,
                      description: taskToDelete.description,
                      status: taskToDelete.status,
                      priority: taskToDelete.priority,
                      user_id: taskToDelete.user_id,
                    });

                  if (restoreError) throw restoreError;

                  toast({
                    title: 'Task restored',
                    description: 'Task has been restored successfully',
                  });
                  fetchTasks();
                } catch (error) {
                  console.error('Error restoring task:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to restore task',
                    variant: 'destructive',
                  });
                }
              }
            }}
          >
            Undo
          </Button>
        ),
      });
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleTaskSaved = () => {
    fetchTasks();
    handleDialogClose();
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Task status changed to ${newStatus}`,
      });
      fetchTasks();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'warning';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'warning';
      case 'pending':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group tasks by user for admin view
  const usersData = isAdmin
    ? Object.values(tasks.reduce((acc, task) => {
        const userName = task.profiles?.full_name || task.profiles?.email || 'Unknown User';
        const userEmail = task.profiles?.email || '';
        if (!acc[task.user_id]) {
          acc[task.user_id] = { userName, userEmail, userId: task.user_id, tasks: [] };
        }
        acc[task.user_id].tasks.push(task);
        return acc;
      }, {} as Record<string, SelectedUser>))
    : [];

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Clock, Calendar & Chat Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ClockCalendarWidget />
          <ChatSection />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">
              {isAdmin ? 'All Users Tasks' : 'Your Tasks'}
            </h2>
            <p className="text-muted-foreground">
              {isAdmin ? 'Manage tasks for all users across the system' : 'Manage your personal tasks'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant={showUserList ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setShowUserList(!showUserList); setSelectedUser(null); }}
              >
                <List className="mr-2 h-4 w-4" />
                {showUserList ? 'Hide Users' : 'View Users'}
              </Button>
            )}
            {isAdmin ? (
              <div className="flex gap-2">
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  For Myself
                </Button>
                <Button variant="outline" onClick={() => setAssignDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  For Users
                </Button>
              </div>
            ) : (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            )}
          </div>
        </div>

        {/* Filters Section - Only show when not in user detail view */}
        {!selectedUser && (
          <Card className="mb-6">
            <CardHeader className="pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Filters & Sort</CardTitle>
              </div>
              {isAdmin && (
                <div className="inline-flex rounded-md border border-border bg-card/80 p-1 text-xs sm:text-sm">
                  <Button
                    type="button"
                    variant={adminViewMode === 'self' ? 'default' : 'ghost'}
                    size="sm"
                    className="px-3 py-1"
                    onClick={() => setAdminViewMode('self')}
                  >
                    My tasks
                  </Button>
                  <Button
                    type="button"
                    variant={adminViewMode === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className="px-3 py-1"
                    onClick={() => setAdminViewMode('all')}
                  >
                    All users
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'newest' | 'oldest')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : selectedUser ? (
          <UserPerformanceView
            userName={selectedUser.userName}
            userEmail={selectedUser.userEmail}
            userId={selectedUser.userId}
            tasks={selectedUser.tasks}
            onBack={() => setSelectedUser(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            isAdmin={isAdmin}
            currentUserId={user?.id}
          />
        ) : isAdmin && showUserList ? (
          <UserListView
            users={usersData}
            onUserClick={(userData) => setSelectedUser(userData)}
          />
        ) : tasks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">No tasks yet. Create your first task!</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            </CardContent>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">No tasks match your filters.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => (
              <Card key={task.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <div className="flex gap-2">
                      {(isAdmin || task.user_id === user?.id) && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(task)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(task.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(isAdmin || task.user_id === user?.id) ? (
                      <Select
                        value={task.status}
                        onValueChange={(value) => handleStatusChange(task.id, value)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getStatusColor(task.status)} className="capitalize">
                        {task.status}
                      </Badge>
                    )}
                    <Badge variant={getPriorityColor(task.priority)} className="capitalize">
                      {task.priority}
                    </Badge>
                    {isAdmin && task.profiles && (
                      <Badge variant="secondary" className="gap-1">
                        <User className="h-3 w-3" />
                        {task.profiles.full_name || task.profiles.email}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-3">
                    {task.description || 'No description'}
                  </CardDescription>
                  <p className="text-xs text-muted-foreground mt-4">
                    Created {new Date(task.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <TaskDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          onTaskSaved={handleTaskSaved}
          task={editingTask}
        />

        <TaskAssignmentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onSuccess={fetchTasks}
        />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
