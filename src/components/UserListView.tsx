import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User, ChevronRight, CheckCircle2, Circle, PlayCircle } from 'lucide-react';

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

interface UserData {
  userName: string;
  userEmail: string;
  userId: string;
  tasks: Task[];
}

interface UserListViewProps {
  users: UserData[];
  onUserClick: (user: UserData) => void;
}

export const UserListView = ({ users, onUserClick }: UserListViewProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold">Users Overview</h3>
        <Badge variant="secondary" className="ml-2">
          {users.length} {users.length === 1 ? 'user' : 'users'}
        </Badge>
      </div>

      {users.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((userData) => {
            const total = userData.tasks.length;
            const completed = userData.tasks.filter(t => t.status === 'completed').length;
            const inProgress = userData.tasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress').length;
            const pending = userData.tasks.filter(t => t.status === 'pending').length;
            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <Card
                key={userData.userId}
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
                onClick={() => onUserClick(userData)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{userData.userName}</CardTitle>
                        <CardDescription className="text-xs truncate max-w-[150px]">
                          {userData.userEmail}
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tasks</span>
                    <Badge variant="secondary">{total}</Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Completion</span>
                      <span className="font-medium">{completionRate}%</span>
                    </div>
                    <Progress value={completionRate} className="h-2" />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Circle className="h-3 w-3" /> {pending}
                    </span>
                    <span className="flex items-center gap-1">
                      <PlayCircle className="h-3 w-3" /> {inProgress}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {completed}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
