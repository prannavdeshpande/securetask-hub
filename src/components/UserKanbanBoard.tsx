import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Trash2, Clock, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  user_id: string;
}

interface UserKanbanBoardProps {
  userName: string;
  userId: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  isAdmin: boolean;
  currentUserId?: string;
}

export const UserKanbanBoard = ({
  userName,
  userId,
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  isAdmin,
  currentUserId,
}: UserKanbanBoardProps) => {
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const total = tasks.length;
  const completed = completedTasks.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

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

  const StatusColumn = ({ 
    title, 
    tasks, 
    icon: Icon, 
    colorClass 
  }: { 
    title: string; 
    tasks: Task[]; 
    icon: any; 
    colorClass: string;
  }) => (
    <div className="flex-1 min-w-[280px]">
      <div className={cn(
        "flex items-center gap-2 mb-3 pb-2 border-b-2",
        colorClass
      )}>
        <Icon className="h-4 w-4" />
        <h4 className="font-semibold text-sm">{title}</h4>
        <Badge variant="outline" className="ml-auto">
          {tasks.length}
        </Badge>
      </div>
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No tasks
          </div>
        ) : (
          tasks.map(task => (
            <Card 
              key={task.id} 
              className="hover:shadow-md transition-all duration-200 animate-fade-in border-l-4"
              style={{
                borderLeftColor: task.priority === 'high' 
                  ? 'hsl(var(--destructive))' 
                  : task.priority === 'medium' 
                  ? 'hsl(var(--warning))' 
                  : 'hsl(var(--muted))'
              }}
            >
              <CardHeader className="p-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium line-clamp-2">
                    {task.title}
                  </CardTitle>
                  <div className="flex gap-1 shrink-0">
                    {(isAdmin || task.user_id === currentUserId) && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit(task)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onDelete(task.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {task.description && (
                  <CardDescription className="text-xs line-clamp-2 mb-2">
                    {task.description}
                  </CardDescription>
                )}
                <div className="flex items-center justify-between">
                  <Badge variant={getPriorityColor(task.priority)} className="text-xs capitalize">
                    {task.priority}
                  </Badge>
                  {(isAdmin || task.user_id === currentUserId) && (
                    <Select
                      value={task.status}
                      onValueChange={(value) => onStatusChange(task.id, value)}
                    >
                      <SelectTrigger className="h-6 w-24 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {new Date(task.created_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden animate-scale-in">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <CardTitle className="text-lg">{userName}</CardTitle>
            <CardDescription className="text-xs mt-1">
              Task completion overview
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {completionRate}%
              </div>
              <div className="text-xs text-muted-foreground">
                {completed} of {total} completed
              </div>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="transform -rotate-90 w-16 h-16">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className="text-muted"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - completionRate / 100)}`}
                  className="text-primary transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Progress value={completionRate} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Circle className="h-3 w-3" /> Pending: {pendingTasks.length}
            </span>
            <span className="flex items-center gap-1">
              <PlayCircle className="h-3 w-3" /> In Progress: {inProgressTasks.length}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Completed: {completedTasks.length}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex gap-4 overflow-x-auto pb-2">
          <StatusColumn
            title="Pending"
            tasks={pendingTasks}
            icon={Circle}
            colorClass="border-muted-foreground/30 text-muted-foreground"
          />
          <StatusColumn
            title="In Progress"
            tasks={inProgressTasks}
            icon={PlayCircle}
            colorClass="border-warning text-warning"
          />
          <StatusColumn
            title="Completed"
            tasks={completedTasks}
            icon={CheckCircle2}
            colorClass="border-primary text-primary"
          />
        </div>
      </CardContent>
    </Card>
  );
};
