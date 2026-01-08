import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Target, CheckCircle2 } from 'lucide-react';

interface CompletionRateCardProps {
  userName: string;
  userId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
}

export const CompletionRateCard = ({
  userName,
  totalTasks,
  completedTasks,
  inProgressTasks,
  pendingTasks,
}: CompletionRateCardProps) => {
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const inProgressRate = totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0;
  const pendingRate = totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0;

  // Determine trend icon (simplified - in real app you'd compare with historical data)
  const getTrendIcon = () => {
    if (completionRate >= 75) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (completionRate >= 50) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-destructive" />;
  };

  const getPerformanceLabel = () => {
    if (completionRate >= 75) return { text: 'Excellent', color: 'bg-green-500/10 text-green-700 border-green-500/20' };
    if (completionRate >= 50) return { text: 'Good', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' };
    if (completionRate >= 25) return { text: 'Fair', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' };
    return { text: 'Needs Attention', color: 'bg-destructive/10 text-destructive border-destructive/20' };
  };

  const performanceLabel = getPerformanceLabel();

  return (
    <Card className="hover:shadow-lg transition-all duration-200 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{userName}</CardTitle>
              <CardDescription className="text-xs">Performance metrics</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {getTrendIcon()}
            <Badge className={performanceLabel.color} variant="outline">
              {performanceLabel.text}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main completion rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Completion Rate
            </span>
            <span className="text-2xl font-bold text-primary">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-3" />
          <p className="text-xs text-muted-foreground">
            {completedTasks} of {totalTasks} tasks completed
          </p>
        </div>

        {/* Task breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="text-lg font-bold">{pendingTasks}</div>
            <Progress value={pendingRate} className="h-1" />
            <div className="text-[10px] text-muted-foreground">{pendingRate}%</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground">In Progress</div>
            <div className="text-lg font-bold text-warning">{inProgressTasks}</div>
            <Progress value={inProgressRate} className="h-1" />
            <div className="text-[10px] text-muted-foreground">{inProgressRate}%</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-lg font-bold text-primary">{completedTasks}</div>
            <Progress value={100} className="h-1" />
            <div className="text-[10px] text-muted-foreground">{completionRate}%</div>
          </div>
        </div>

        {/* Visual indicator bars */}
        <div className="space-y-2 pt-2">
          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-muted transition-all duration-300" 
              style={{ width: `${pendingRate}%` }}
            />
            <div 
              className="bg-warning/70 transition-all duration-300" 
              style={{ width: `${inProgressRate}%` }}
            />
            <div 
              className="bg-primary transition-all duration-300" 
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
