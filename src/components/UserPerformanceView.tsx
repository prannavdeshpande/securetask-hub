import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, BarChart3, PieChart, TrendingUp, Lock } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  user_id: string;
  is_private?: boolean;
}

interface UserPerformanceViewProps {
  userName: string;
  userEmail: string;
  userId: string;
  tasks: Task[];
  onBack: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  isAdmin: boolean;
  currentUserId?: string;
}

export const UserPerformanceView = ({
  userName,
  userEmail,
  userId,
  tasks,
  onBack,
  onEdit,
  onDelete,
  onStatusChange,
  isAdmin,
  currentUserId,
}: UserPerformanceViewProps) => {
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'progress'>('pie');

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const total = tasks.length;
  const completed = completedTasks.length;
  const inProgress = inProgressTasks.length;
  const pending = pendingTasks.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const statusData = [
    { name: 'Pending', value: pending, color: 'hsl(var(--muted-foreground))' },
    { name: 'In Progress', value: inProgress, color: 'hsl(var(--warning))' },
    { name: 'Completed', value: completed, color: 'hsl(var(--primary))' },
  ];

  const priorityData = [
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: 'hsl(var(--destructive))' },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: 'hsl(var(--warning))' },
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: 'hsl(var(--secondary))' },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'warning';
      case 'pending': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{userName}</h2>
          <p className="text-muted-foreground text-sm">{userEmail}</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {completionRate}% Complete
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{total}</div>
            <p className="text-sm text-muted-foreground">Total Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-muted-foreground">{pending}</div>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Circle className="h-3 w-3" /> Pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold" style={{ color: 'hsl(var(--warning))' }}>{inProgress}</div>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <PlayCircle className="h-3 w-3" /> In Progress
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{completed}</div>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Performance Analytics</CardTitle>
            <CardDescription>Task distribution and progress visualization</CardDescription>
          </div>
          <Select value={chartType} onValueChange={(v) => setChartType(v as 'pie' | 'bar' | 'progress')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pie">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Pie Chart
                </div>
              </SelectItem>
              <SelectItem value="bar">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Bar Chart
                </div>
              </SelectItem>
              <SelectItem value="progress">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Progress View
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartType === 'pie' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-medium mb-4 text-center">Status Distribution</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend 
                      layout="horizontal" 
                      verticalAlign="bottom" 
                      align="center"
                      wrapperStyle={{ paddingTop: '10px' }}
                      formatter={(value, entry) => {
                        const dataItem = statusData.find(d => d.name === value);
                        return `${value}: ${dataItem?.value || 0}`;
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-4 text-center">Priority Distribution</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={false}
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend 
                      layout="horizontal" 
                      verticalAlign="bottom" 
                      align="center"
                      wrapperStyle={{ paddingTop: '10px' }}
                      formatter={(value) => {
                        const dataItem = priorityData.find(d => d.name === value);
                        return `${value}: ${dataItem?.value || 0}`;
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartType === 'bar' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-medium mb-4 text-center">Tasks by Status</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-4 text-center">Tasks by Priority</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartType === 'progress' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Completion</span>
                  <span className="font-medium">{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="h-4" />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Circle className="h-3 w-3" /> Pending
                    </span>
                    <span>{total > 0 ? Math.round((pending / total) * 100) : 0}%</span>
                  </div>
                  <Progress value={total > 0 ? (pending / total) * 100 : 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <PlayCircle className="h-3 w-3" /> In Progress
                    </span>
                    <span>{total > 0 ? Math.round((inProgress / total) * 100) : 0}%</span>
                  </div>
                  <Progress value={total > 0 ? (inProgress / total) * 100 : 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Completed
                    </span>
                    <span>{total > 0 ? Math.round((completed / total) * 100) : 0}%</span>
                  </div>
                  <Progress value={total > 0 ? (completed / total) * 100 : 0} className="h-2" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks ({tasks.length})</CardTitle>
          <CardDescription>Click on a task to edit or change status</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No tasks assigned</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{task.title}</h4>
                        {task.is_private && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Lock className="h-3 w-3" />
                            Private
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getPriorityColor(task.priority)} className="capitalize">
                        {task.priority}
                      </Badge>
                      {(isAdmin || task.user_id === currentUserId) ? (
                        <Select
                          value={task.status}
                          onValueChange={(value) => onStatusChange(task.id, value)}
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
