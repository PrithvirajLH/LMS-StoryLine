import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { 
  BookOpen, Home, Play, BarChart3, BookCheck, Users, Activity, Eye, Layers, FileText, FileSpreadsheet,
  LogOut, GraduationCap, ChevronLeft, ChevronRight, Menu, X, Building2
} from "lucide-react";
import { getUser, isAdmin, logout } from "@/services/auth";
import { useCurrentCourse } from "@/contexts/CurrentCourseContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavMode = "learner" | "admin" | "manager" | "coordinator" | "coach" | "corporate";

export const Sidebar = ({ mode = "learner" }: { mode?: NavMode }) => {
  const { currentCourse } = useCurrentCourse();
  const location = useLocation();
  const user = getUser();
  const admin = isAdmin();
  const isOnCoursePage = location.pathname.startsWith("/learner/player/");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const learnerNavItems = [
    { href: "/learner/dashboard", label: "Home", icon: Home },
    { href: "/learner/courses", label: "Browse", icon: BookOpen },
  ];

  const adminNavItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/courses", label: "Courses", icon: BookCheck },
    { href: "/admin/learners", label: "Learners", icon: GraduationCap },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/providers", label: "Providers", icon: Building2 },
    { href: "/admin/activity-report", label: "Activity Report", icon: FileSpreadsheet },
    { href: "/admin/reports", label: "Reports", icon: FileSpreadsheet },
  ];

  const managerNavItems = [
    { href: "/manager/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/manager/team", label: "Team", icon: Users },
    { href: "/manager/reports", label: "Reports", icon: FileSpreadsheet },
  ];

  const coordinatorNavItems = [
    { href: "/coordinator/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/coordinator/assignments", label: "Assignments", icon: BookCheck },
    { href: "/coordinator/groups", label: "Groups", icon: Users },
    { href: "/coordinator/reports", label: "Reports", icon: FileSpreadsheet },
  ];

  const coachNavItems = [
    { href: "/coach/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/coach/courses", label: "Courses", icon: BookCheck },
    { href: "/coach/xapi", label: "xAPI", icon: Activity },
  ];

  const corporateNavItems = [
    { href: "/corporate/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/corporate/reports", label: "Reports", icon: FileSpreadsheet },
  ];

  const xapiNavItems = [
    { href: "/admin/xapi/verbs", label: "xAPI Verbs", icon: Activity },
    { href: "/admin/xapi/module-rules", label: "Module Rules", icon: Layers },
    { href: "/admin/xapi/inspector", label: "Statement Inspector", icon: Eye },
    { href: "/admin/xapi/kc-attempts", label: "KC Attempts", icon: FileText },
    { href: "/admin/xapi/kc-scores", label: "KC Scores", icon: BarChart3 },
  ];

  const NavLink = ({ href, label, icon: Icon, isActive }: { href: string; label: string; icon: any; isActive: boolean }) => {
    const content = (
      <Link
        to={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
          isActive
            ? "bg-rose-900 text-white shadow-md"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "" : "group-hover:scale-110 transition-transform"}`} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="text-sm font-medium whitespace-nowrap overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-3 pt-4 space-y-1">
        {mode === "learner" && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Learning
              </p>
            )}
            {learnerNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname === item.href}
              />
            ))}
          </div>
        )}

        {mode === "manager" && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Manager
              </p>
            )}
            {managerNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}

        {mode === "coordinator" && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Coordinator
              </p>
            )}
            {coordinatorNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}

        {mode === "coach" && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Instructional Coach
              </p>
            )}
            {coachNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}

        {mode === "corporate" && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Corporate
              </p>
            )}
            {corporateNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}

        {/* Admin Navigation */}
        {mode === "admin" && admin && (
          <div className="space-y-1 pt-4">
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </p>
            )}
            {collapsed && <div className="h-px bg-border my-2" />}
            {adminNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname.startsWith(item.href)}
              />
            ))}

            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3">
                xAPI
              </p>
            )}
            {collapsed && <div className="h-px bg-border my-2" />}
            {xapiNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Now Playing / Current Course */}
      {currentCourse && isOnCoursePage && (
        <div className={`p-3 border-t border-border ${collapsed ? "px-2" : ""}`}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-3 text-white ${collapsed ? "p-2" : ""}`}
            style={{
              background: 'linear-gradient(135deg, #FF6B9D, #C44569, #8B5FBF)'
            }}
          >
            <div className="flex items-center gap-3">
              <Play className="h-5 w-5 flex-shrink-0" />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium opacity-80">Now Learning</p>
                  <p className="text-sm font-bold truncate">{currentCourse.title}</p>
                  {currentCourse.progress !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white rounded-full transition-all duration-300"
                          style={{ width: `${currentCourse.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold">{Math.round(currentCourse.progress)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* User Section */}
      {user && (
        <div className={`p-3 border-t border-border ${collapsed ? "px-2" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "flex-col" : ""}`}>
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback 
                className="text-white text-sm font-medium"
                style={{ backgroundColor: '#881337' }}
              >
                {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.firstName || user.email?.split("@")[0] || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`w-full mt-2 text-muted-foreground hover:text-foreground hover:bg-muted ${
              collapsed ? "px-2" : "justify-start"
            }`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      )}

      {/* Collapse Toggle - Desktop only */}
      <div className="p-3 border-t border-border hidden lg:block">
        <Button
          variant="ghost"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      {/* Mobile Menu Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden h-10 w-10 bg-background/95 backdrop-blur-sm shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-72 bg-background border-r border-border z-50 lg:hidden"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4"
            >
              <X className="h-5 w-5" />
            </Button>
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 bg-background border-r border-border z-40"
      >
        {sidebarContent}
      </motion.aside>

      {/* Spacer for content */}
      <motion.div
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="hidden lg:block flex-shrink-0"
      />
    </TooltipProvider>
  );
};
