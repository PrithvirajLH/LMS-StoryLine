import { createContext, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronRight,
  Activity
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
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 100 : 256 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 shadow-sm ${
        isCollapsed ? 'w-[100px]' : 'w-64'
      }`}
    >
      {/* Brand Logo & Toggle */}
      <div className={`border-b border-border flex items-center h-20 ${isCollapsed ? 'justify-center px-3 relative' : 'justify-between px-6'}`}>
        {!isCollapsed ? (
          <motion.div
            key="expanded-logo"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-center flex-1 min-w-0"
          >
            <img 
              src="/assets/images/logo-full.png" 
              alt="Creative Learning" 
              className="h-8 w-auto object-contain"
            />
          </motion.div>
        ) : (
          <motion.button
            key="collapsed-logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={toggleSidebar}
            className="flex items-center justify-center w-full hover:opacity-80 transition-opacity"
            title="Expand sidebar"
          >
            <img 
              src="/assets/images/logo-icon.png" 
              alt="Creative Learning" 
              className="h-10 w-10 object-contain"
            />
          </motion.button>
        )}
        
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 hover:bg-muted transition-all duration-200"
            onClick={toggleSidebar}
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={item.href}
                className={`relative flex items-center rounded-lg transition-all duration-200 group ${
                  isCollapsed ? 'justify-center p-3 w-fit mx-auto' : 'px-3 py-2.5 gap-3'
                } ${
                  isActive
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-foreground rounded-lg"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`relative z-10 h-5 w-5 flex-shrink-0 transition-transform duration-200 ${
                  isActive ? 'text-background' : 'group-hover:scale-110'
                }`} />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className={`relative z-10 text-sm font-medium ${isActive ? 'text-background' : ''}`}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}
        
        {admin && (
          <>
            <div className={`${isCollapsed ? 'py-2' : 'px-3 py-3'}`}>
              {!isCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Admin
                </motion.p>
              )}
            </div>
            {[
              { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
              { href: "/admin/courses", label: "Courses", icon: BookCheck },
              { href: "/admin/learners", label: "Learners", icon: Users },
              { href: "/admin/verbs", label: "xAPI Verbs", icon: Activity },
            ].map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.href);
              
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (navItems.length + index) * 0.05 }}
                >
                  <Link
                    to={item.href}
                    className={`relative flex items-center rounded-lg transition-all duration-200 group ${
                      isCollapsed ? 'justify-center p-3 w-fit mx-auto' : 'px-3 py-2.5 gap-3'
                    } ${
                      isActive
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="adminActiveIndicator"
                        className="absolute inset-0 bg-foreground rounded-lg"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon className={`relative z-10 h-5 w-5 flex-shrink-0 transition-transform duration-200 ${
                      isActive ? 'text-background' : 'group-hover:scale-110'
                    }`} />
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className={`relative z-10 text-sm font-medium ${isActive ? 'text-background' : ''}`}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                </motion.div>
              );
            })}
          </>
        )}
      </nav>

      {/* User Profile Section */}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-border p-3"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center rounded-lg hover:bg-muted transition-all duration-200 group ${
                isCollapsed ? 'justify-center p-2' : 'px-3 py-2.5 gap-3'
              }`}>
                <Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-border group-hover:ring-foreground/20 transition-all duration-200">
                  <AvatarFallback className="bg-foreground text-background text-xs font-semibold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.firstName || user.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
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
        </motion.div>
      )}
    </motion.aside>
  );
};
