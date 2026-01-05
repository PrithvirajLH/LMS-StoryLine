import { useState, createContext, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  BookOpen, 
  Settings, 
  LogOut,
  GraduationCap,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export const Sidebar = ({ isCollapsed, toggleSidebar }: SidebarProps) => {
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
    <aside className={`fixed left-0 top-0 h-screen bg-card border-r border-border/50 flex flex-col z-50 shadow-sm transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
        {/* Brand Logo + Name */}
        <div className={`border-b border-border/50 transition-all duration-300 ${isCollapsed ? 'p-4' : 'p-6'}`}>
          {isCollapsed ? (
            // Collapsed: Center logo, make it clickable to expand
            <div className="flex items-center justify-center w-full">
              <button
                onClick={toggleSidebar}
                className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center hover:bg-primary/30 hover:border-primary/50 transition-all cursor-pointer shadow-sm"
                aria-label="Expand sidebar"
                title="Click to expand sidebar"
              >
                <GraduationCap className="h-6 w-6 text-primary" />
              </button>
            </div>
          ) : (
            // Expanded: Show logo, name, and toggle button
            <div className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <AnimatePresence mode="wait">
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-base font-semibold text-foreground whitespace-nowrap"
                  >
                    Creative Learning
                  </motion.span>
                </AnimatePresence>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 flex-shrink-0"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-3'} space-y-1`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
                  isCollapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
          
          {admin && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
                isCollapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'
              } ${
                location.pathname === "/admin"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
              title={isCollapsed ? "Admin" : undefined}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    Admin
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )}
        </nav>

        {/* User Section */}
        {user && (
          <div className={`border-t border-border/50 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`w-full flex items-center gap-3 rounded-lg hover:bg-secondary/50 transition-colors ${
                  isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
                }`}>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <AnimatePresence mode="wait">
                    {!isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex-1 text-left min-w-0 overflow-hidden"
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
          </div>
        )}
      </aside>
  );
};

