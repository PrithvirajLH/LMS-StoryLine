import { useNavigate } from 'react-router-dom';
import { logout, getUser } from '../services/auth';

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const user = getUser();

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/50 backdrop-blur-xl">
      <div className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-6">
          <h1 
            onClick={() => navigate('/courses')}
            className="text-3xl font-bold text-gradient-primary cursor-pointer hover:scale-105 transition-transform duration-200"
          >
            🎓 Creative Learning
          </h1>
          {title && (
            <span className="text-lg text-muted-foreground font-medium">
              {title}
            </span>
          )}
        </div>
        <nav className="flex items-center gap-2">
          <button
            onClick={() => navigate('/courses')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-200 hover:scale-105"
          >
            Courses
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-200 hover:scale-105"
          >
            My Progress
          </button>
          {user?.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all duration-200 hover:scale-105"
            >
              Admin
            </button>
          )}
          <div className="flex items-center gap-4 ml-4 pl-4 border-l border-border/50">
            <span className="text-sm text-muted-foreground font-medium">
              {user?.firstName || user?.email?.split('@')[0]}
            </span>
            <button
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-destructive hover:bg-destructive/90 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
            >
              Logout
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
