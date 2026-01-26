import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Home, Play, BarChart3, BookCheck, Users, Activity, LogOut, GraduationCap, FileSpreadsheet } from "lucide-react";
import { getUser, logout } from "@/services/auth";
import { useCurrentCourse } from "@/contexts/CurrentCourseContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type NavMode = "learner" | "admin" | "manager" | "coordinator" | "coach" | "corporate";

export const NowBar = ({ mode = "learner" }: { mode?: NavMode }) => {
  const { currentCourse } = useCurrentCourse();
  const location = useLocation();
  const user = getUser();
  const isOnCoursePage = location.pathname.startsWith("/learner/player/");

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const learnerNavItems = [
    { href: "/learner/dashboard", label: "Home", icon: Home },
    { href: "/learner/courses", label: "Browse", icon: BookOpen },
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

  const adminNavItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/courses", label: "Courses", icon: BookCheck },
    { href: "/admin/learners", label: "Learners", icon: GraduationCap },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/xapi/verbs", label: "xAPI Verbs", icon: Activity },
  ];

  const navItems =
    mode === "admin"
      ? adminNavItems
      : mode === "manager"
        ? managerNavItems
        : mode === "coordinator"
          ? coordinatorNavItems
          : mode === "coach"
            ? coachNavItems
            : mode === "corporate"
              ? corporateNavItems
              : learnerNavItems;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-3 sm:bottom-4 md:bottom-6 left-1/2 z-50 max-w-[95vw]"
    >
      <div 
        className="rounded-full px-3 sm:px-5 md:px-7 py-2 sm:py-3 md:py-4 flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 shadow-lg sm:shadow-xl md:shadow-2xl border sm:border-2 border-foreground/20 flex-nowrap overflow-x-auto scrollbar-hide bg-background/95 backdrop-blur-xl"
      >
        {/* Navigation Items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            mode === "admin"
              ? location.pathname.startsWith(item.href)
              : location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 flex-shrink-0 ${
                isActive
                  ? "bg-foreground text-background"
                  : "text-foreground hover:text-foreground hover:bg-foreground/15"
              }`}
              title={item.label}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-sm sm:text-base font-semibold hidden sm:inline whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}

        {/* Current Activity - Highlighted */}
        {mode === "learner" && currentCourse && isOnCoursePage ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 sm:gap-2 md:gap-3 px-2 sm:px-3 md:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-accent text-white flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FF6B9D, #C44569, #8B5FBF)'
            }}
          >
            <Play className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-semibold opacity-95 hidden sm:inline">Now Learning</span>
              <span className="text-xs sm:text-sm md:text-base font-bold truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                {currentCourse.title}
              </span>
            </div>
            {currentCourse.progress !== undefined && (
              <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2 pl-1.5 sm:pl-2 md:pl-3 border-l border-white/30 flex-shrink-0">
                <span className="text-xs sm:text-sm font-bold whitespace-nowrap">{Math.round(currentCourse.progress)}%</span>
              </div>
            )}
          </motion.div>
        ) : user ? (
          <Popover>
            <PopoverTrigger asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm md:text-base font-semibold text-muted-foreground flex-shrink-0 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
              >
                {user?.firstName ? `Hello, ${user.firstName}` : "Ready to learn"}
              </motion.div>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <div className="px-2 py-1.5 mb-2 border-b border-border">
                <p className="text-sm font-medium text-foreground">
                  {user.firstName || user.email?.split("@")[0] || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start text-sm text-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </motion.div>
  );
};
