import { useEffect, useState, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  TrendingUp,
  ChevronRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import api from "../services/api";
import { getUser } from "../services/auth";

interface CourseProgress {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  enrollmentStatus: string;
  completionStatus: string;
  score?: number;
  progressPercent?: number;
  timeSpent?: number; // in seconds (from backend)
  enrolledAt: string;
  startedAt?: string;
  completedAt?: string;
}

const ProgressDashboard = () => {
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const hasLoadedRef = useRef(false);
  
  // Memoize user to prevent infinite re-renders
  const user = useMemo(() => getUser(), []);
  const userId = useMemo(() => {
    const u = getUser();
    return u?.email || u?.userId || null;
  }, []);

  useEffect(() => {
    // Only load once on mount
    if (hasLoadedRef.current) return;
    
    if (userId) {
      hasLoadedRef.current = true;
      loadProgress();
    } else {
      setLoading(false);
      setError('Please log in to view your dashboard');
      hasLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  const loadProgress = async () => {
    // Get fresh userId in case it changed
    const currentUser = getUser();
    const currentUserId = currentUser?.email || currentUser?.userId;
    
    if (!currentUserId) {
      setError('User not found. Please log in again.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(""); // Clear previous errors
      console.log('[Dashboard] Loading courses for user:', currentUserId);
      const response = await api.get(`/api/users/${encodeURIComponent(currentUserId)}/courses`);
      const coursesData = Array.isArray(response.data) ? response.data : [];
      console.log('[Dashboard] Loaded courses:', coursesData.length);
      setCourses(coursesData);
    } catch (err: any) {
      console.error('[Dashboard] Load error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load progress';
      setError(errorMessage);
      setCourses([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const enrolledCourses = courses.filter(c => 
    c && (c.enrollmentStatus === 'enrolled' || c.enrollmentStatus === 'in_progress')
  );
  
  // Calculate stats safely
  const totalTimeSpent = courses.reduce((acc, c) => {
    const time = typeof c.timeSpent === 'number' ? c.timeSpent : 0;
    return acc + time;
  }, 0);
  const hoursLearned = (totalTimeSpent / 3600).toFixed(1);
  
  const stats = [
    { 
      icon: BookOpen, 
      label: "Courses Enrolled", 
      value: enrolledCourses.length.toString(), 
      color: "text-primary" 
    },
    { 
      icon: Clock, 
      label: "Hours Learned", 
      value: hoursLearned, 
      color: "text-info" 
    },
    { 
      icon: Trophy, 
      label: "Certificates", 
      value: courses.filter(c => c && (c.completionStatus === 'completed' || c.completionStatus === 'passed')).length.toString(), 
      color: "text-accent" 
    },
    { 
      icon: TrendingUp, 
      label: "In Progress", 
      value: courses.filter(c => c && c.completionStatus === 'in_progress').length.toString(), 
      color: "text-success" 
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard | Creative Learning</title>
        <meta name="description" content="Track your learning progress, view enrolled courses, and manage your learning journey." />
      </Helmet>

      <div>
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Welcome back{user?.firstName ? `, ${user.firstName}` : ''}! 👋
              </h1>
              <p className="text-muted-foreground">
                Continue your learning journey and track your progress
              </p>
            </motion.div>

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                {error}
              </div>
            )}

            {/* Stats Grid - Applying Law of Proximity & Chunking */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group cursor-default"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center mb-4 ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="h-7 w-7" />
                  </div>
                  <div className="text-3xl font-bold text-foreground mb-1 tracking-tight">{stat.value}</div>
                  <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Continue Learning */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">Continue Learning</h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/courses">View All</Link>
                  </Button>
                </div>

                {loading ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p>Loading courses...</p>
                    </div>
                  </div>
                ) : enrolledCourses.length > 0 ? (
                  <div className="space-y-3">
                    {enrolledCourses.map((course, index) => {
                      if (!course) return null;
                      // Use progressPercent from database (preferred) or fallback to score/completion
                      const progress = course.progressPercent !== undefined && course.progressPercent !== null
                        ? Math.max(0, Math.min(100, Number(course.progressPercent))) // Clamp between 0-100
                        : (course.score ? Math.max(0, Math.min(100, Number(course.score))) : (course.completionStatus === 'completed' || course.completionStatus === 'passed' ? 100 : 0));
                      
                      // Apply Von Restorff Effect - highlight in-progress courses
                      const isInProgress = course.completionStatus === 'in_progress' && progress > 0 && progress < 100;
                      const isCompleted = course.completionStatus === 'completed' || course.completionStatus === 'passed';
                      
                      return (
                        <motion.div
                          key={course.courseId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Link
                            to={`/player/${course.courseId}`}
                            className="block"
                          >
                            <div className={`bg-card rounded-2xl p-5 border transition-all duration-300 group ${
                              isInProgress 
                                ? 'border-primary/30 shadow-md hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 bg-gradient-to-r from-card to-primary/5' 
                                : isCompleted
                                ? 'border-accent/30 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                                : 'border-border/50 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                            }`}>
                              <div className="flex gap-4">
                                {course.thumbnailUrl ? (
                                  <div className="relative flex-shrink-0">
                                    <img
                                      src={course.thumbnailUrl}
                                      alt={course.title}
                                      className="w-28 h-28 md:w-36 md:h-24 rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    {isInProgress && (
                                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-card shadow-lg">
                                        <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse"></div>
                                      </div>
                                    )}
                                    {isCompleted && (
                                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center border-2 border-card shadow-lg">
                                        <Trophy className="w-3 h-3 text-accent-foreground" />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-28 h-28 md:w-36 md:h-24 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                                    <BookOpen className="h-10 w-10 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                      {course.title}
                                    </h3>
                                    <div className="hidden md:flex items-center flex-shrink-0">
                                      <div className="w-10 h-10 rounded-lg bg-secondary group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                      </div>
                                    </div>
                                  </div>
                                  {course.description && (
                                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                      {course.description}
                                    </p>
                                  )}
                                  {/* Goal-Gradient Effect - Show progress prominently */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-muted-foreground font-medium">Progress</span>
                                      <span className={`font-bold ${
                                        progress >= 100 ? 'text-accent' : 
                                        progress >= 50 ? 'text-primary' : 
                                        'text-muted-foreground'
                                      }`}>
                                        {progress}%
                                      </span>
                                    </div>
                                    <Progress 
                                      value={progress} 
                                      className={`h-3 transition-all duration-500 ${
                                        progress >= 100 ? 'bg-accent/20' : 
                                        progress >= 50 ? 'bg-primary/20' : 
                                        ''
                                      }`}
                                    />
                                    {progress > 0 && progress < 100 && (
                                      <p className="text-xs text-muted-foreground">
                                        {100 - Math.round(progress)}% remaining
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-card rounded-2xl p-12 text-center border border-border/50"
                  >
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <BookOpen className="h-10 w-10 text-primary/50" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Start Your Learning Journey</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      You haven't enrolled in any courses yet. Browse our catalog to find courses that interest you.
                    </p>
                    <Button variant="hero" size="lg" asChild className="shadow-lg hover:shadow-xl transition-shadow">
                      <Link to="/courses">Browse Courses</Link>
                    </Button>
                  </motion.div>
                )}

                {/* Empty state CTA - Peak-End Rule: Make last impression great */}
                {enrolledCourses.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 text-center border border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                      <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      Ready to learn something new?
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Explore our catalog and discover your next learning adventure
                    </p>
                    <Button variant="hero" size="lg" asChild className="shadow-md hover:shadow-lg transition-shadow">
                      <Link to="/courses">Browse Courses</Link>
                    </Button>
                  </motion.div>
                )}
              </motion.div>

              {/* Sidebar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                {/* Recent Activity - Serial Position Effect: Show most recent first */}
                <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-lg text-foreground">Recent Activity</h3>
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {courses.length > 0 ? (
                    <div className="space-y-3">
                      {courses.slice(0, 3).map((course, index) => {
                        const statusColor = course.completionStatus === 'completed' || course.completionStatus === 'passed' 
                          ? 'bg-accent' 
                          : course.completionStatus === 'in_progress'
                          ? 'bg-primary'
                          : 'bg-muted-foreground';
                        return (
                          <motion.div
                            key={course.courseId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
                          >
                            <div className={`w-3 h-3 rounded-full ${statusColor} mt-2 flex-shrink-0 group-hover:scale-125 transition-transform`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {course.completionStatus === 'completed' ? 'Completed' : 
                                 course.completionStatus === 'passed' ? 'Passed' :
                                 course.completionStatus === 'in_progress' ? 'In Progress' : 
                                 'Enrolled in'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {course.title}
                              </p>
                              {course.enrolledAt && (
                                <p className="text-xs text-muted-foreground mt-1.5">
                                  {new Date(course.enrolledAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    </div>
                  )}
                </div>

                {/* Achievement Highlight */}
                {courses.filter(c => c.completionStatus === 'completed' || c.completionStatus === 'passed').length > 0 && (
                  <div className="bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl p-6 border border-accent/20">
                    <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                      <Trophy className="h-7 w-7 text-accent" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {courses.filter(c => c.completionStatus === 'completed' || c.completionStatus === 'passed').length} 
                      {courses.filter(c => c.completionStatus === 'completed' || c.completionStatus === 'passed').length === 1 ? ' Course' : ' Courses'} Completed!
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Great progress! Keep up the excellent work.
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
      </div>
    </>
  );
};

export default ProgressDashboard;
