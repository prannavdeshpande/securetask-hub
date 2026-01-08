import { ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/NotificationBell';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  LogOut, 
  Moon, 
  Sun, 
  ListTodo,
  Calendar,
  FileText,
  UserCircle
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export const AppLayout = ({ children, hideNav = false }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { role, isAdmin } = useUserRole();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/chat', label: 'Chat', icon: MessageSquare },
    { path: '/meetings', label: 'Meetings', icon: FileText },
    { path: '/availability', label: 'Availability', icon: Calendar },
  ];

  if (isAdmin) {
    navItems.push({ path: '/user-management', label: 'Users', icon: Users });
  }

  if (hideNav) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold hidden sm:inline">TaskFlow</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => navigate(item.path)}
                className={isActive(item.path) ? 'bg-primary/10 text-primary' : ''}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {role && (
              <Badge variant={isAdmin ? 'default' : 'outline'} className="capitalize hidden sm:inline-flex">
                {role}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground hidden lg:inline">
              {user?.email}
            </span>
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
              <UserCircle className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-border overflow-x-auto">
          <nav className="flex items-center gap-1 px-4 py-2">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => navigate(item.path)}
                className={`shrink-0 ${isActive(item.path) ? 'bg-primary/10 text-primary' : ''}`}
              >
                <item.icon className="h-4 w-4 mr-1" />
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
};
