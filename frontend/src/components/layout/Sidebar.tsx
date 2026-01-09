import { createContext, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BookOpen, 
  Settings, 
  LogOut,
  GraduationCap,
  Users,
  BookCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout, getUser, isAdmin } from "@/services/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Browse", icon: BookOpen },
];

// Context to share sidebar state
export interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextType>({ 
  isCollapsed: false,
  toggleSidebar: () => {}
});

export const useSidebar = () => useContext(SidebarContext);

interface SidebarProps {
  isCollapsed?: boolean;
  toggleSidebar?: () => void;
}

export const Sidebar = ({ isCollapsed = true, toggleSidebar }: SidebarProps) => {
  const location = useLocation();
  const user = getUser();
  const admin = isAdmin();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-background border-r border-border/30 flex flex-col z-50 transition-all duration-300 ${
      isCollapsed ? 'w-[100px]' : 'w-64'
    }`}>
        {/* Brand Logo & Toggle */}
        <div className={`border-b border-border/30 flex items-center h-[113px] ${isCollapsed ? 'justify-center p-1.5' : 'justify-between p-4'}`}>
          {!isCollapsed && (
            <div className="flex items-center flex-1 min-w-0">
              <img 
                src="/assets/images/logo-full.png" 
                alt="Creative Learning" 
                className="h-25 w-full object-contain"
              />
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center justify-center w-full gap-1.5 ml-[10px] h-[70px]">
              <img 
                src="/assets/images/logo-icon.png" 
                alt="Creative Learning" 
                className="h-[60px] w-[60px] object-contain flex-shrink-0"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 p-0"
                onClick={toggleSidebar}
                title="Expand sidebar"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={toggleSidebar}
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center rounded-lg transition-all ${
                  isCollapsed ? 'justify-center p-3 w-fit mx-auto' : 'px-3 py-2 gap-3'
                } ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-6 w-6 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
          
          {admin && (
            <>
              <div className={`${isCollapsed ? '' : 'px-2 py-1'}`}>
                {!isCollapsed && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                    Admin
                  </p>
                )}
              </div>
              <Link
                to="/admin/dashboard"
                className={`flex items-center rounded-lg transition-all ${
                  isCollapsed ? 'justify-center p-3 w-fit mx-auto' : 'px-3 py-2 gap-3'
                } ${
                  location.pathname.startsWith("/admin/dashboard")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={isCollapsed ? "Admin Dashboard" : undefined}
              >
                <BarChart3 className="h-6 w-6 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">Dashboard</span>
                )}
              </Link>
              <Link
                to="/admin/courses"
                className={`flex items-center rounded-lg transition-all ${
                  isCollapsed ? 'justify-center p-3 w-fit mx-auto' : 'px-3 py-2 gap-3'
                } ${
                  location.pathname.startsWith("/admin/courses")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={isCollapsed ? "Course Management" : undefined}
              >
                <BookCheck className="h-6 w-6 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">Courses</span>
                )}
              </Link>
              <Link
                to="/admin/learners"
                className={`flex items-center rounded-lg transition-all ${
                  isCollapsed ? 'justify-center p-3 w-fit mx-auto' : 'px-3 py-2 gap-3'
                } ${
                  location.pathname.startsWith("/admin/learners")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={isCollapsed ? "Learner Management" : undefined}
              >
                <Users className="h-6 w-6 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">Learners</span>
                )}
              </Link>
            </>
          )}
        </nav>

        {/* User Profile Section */}
        {user && (
          <div className="border-t border-border/30 p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`w-full flex items-center rounded-lg hover:bg-muted/50 transition-colors ${
                  isCollapsed ? 'justify-center p-3' : 'px-3 py-2 gap-3'
                }`}>
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.firstName || user.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {user.firstName || user.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </aside>
  );
};

