import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Home, Play, BarChart3, BookCheck, Users, Activity, LogOut } from "lucide-react";
import { getUser, isAdmin, logout } from "@/services/auth";
import { useCurrentCourse } from "@/contexts/CurrentCourseContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export const NowBar = () => {
  const { currentCourse } = useCurrentCourse();
  const location = useLocation();
  const user = getUser();
  const admin = isAdmin();
  const isOnCoursePage = location.pathname.startsWith("/player/");

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const adminNavItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/courses", label: "Courses", icon: BookCheck },
    { href: "/admin/learners", label: "Learners", icon: Users },
    { href: "/admin/verbs", label: "xAPI Verbs", icon: Activity },
  ];

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-6 left-1/2 z-50 max-w-[95vw]"
    >
      <div 
        className="rounded-full px-5 sm:px-7 py-4 flex items-center gap-2 sm:gap-4 shadow-2xl border-2 border-foreground/20 flex-nowrap overflow-x-auto scrollbar-hide bg-background/95 backdrop-blur-xl"
      >
        {/* Navigation Items */}
        <Link
          to="/dashboard"
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full transition-all duration-200 flex-shrink-0 ${
            location.pathname === "/dashboard"
              ? "bg-foreground text-background"
              : "text-foreground hover:text-foreground hover:bg-foreground/15"
          }`}
        >
          <Home className="h-5 w-5 flex-shrink-0" />
          <span className="text-base font-semibold hidden sm:inline whitespace-nowrap">Home</span>
        </Link>

        <Link
          to="/courses"
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full transition-all duration-200 flex-shrink-0 ${
            location.pathname === "/courses"
              ? "bg-foreground text-background"
              : "text-foreground hover:text-foreground hover:bg-foreground/15"
          }`}
        >
          <BookOpen className="h-5 w-5 flex-shrink-0" />
          <span className="text-base font-semibold hidden sm:inline whitespace-nowrap">Browse</span>
        </Link>

        {/* Admin Navigation - Partitioned Section */}
        {admin && (
          <>
            <div className="h-6 w-px bg-border flex-shrink-0" />
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full transition-all duration-200 flex-shrink-0 ${
                      isActive
                        ? "bg-foreground text-background"
                        : "text-foreground hover:text-foreground hover:bg-foreground/15"
                    }`}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-semibold hidden xl:inline whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="h-6 w-px bg-border flex-shrink-0" />
          </>
        )}

        {/* Current Activity - Highlighted */}
        {currentCourse && isOnCoursePage ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 rounded-full bg-gradient-accent text-white flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FF6B9D, #C44569, #8B5FBF)'
            }}
          >
            <Play className="h-5 w-5 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold opacity-95 hidden sm:inline">Now Learning</span>
              <span className="text-sm sm:text-base font-bold truncate max-w-[120px] sm:max-w-[200px]">
                {currentCourse.title}
              </span>
            </div>
            {currentCourse.progress !== undefined && (
              <div className="flex items-center gap-2 ml-1 sm:ml-2 pl-2 sm:pl-3 border-l border-white/30 flex-shrink-0">
                <span className="text-sm font-bold whitespace-nowrap">{Math.round(currentCourse.progress)}%</span>
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
                className="px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold text-muted-foreground flex-shrink-0 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
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
