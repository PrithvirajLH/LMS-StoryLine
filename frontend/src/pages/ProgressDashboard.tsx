import { useEffect, useState, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  Play,
  ArrowRight,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import api from "../services/api";
import { getUser } from "../services/auth";
import HeroStatement from "@/components/HeroStatement";
import ArtifactCollection from "@/components/ArtifactCollection";
import { getArtifacts } from "@/services/artifacts";

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
  category?: string;
}

const ProgressDashboard = () => {
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);
  
  const user = useMemo(() => getUser(), []);
  const userId = useMemo(() => {
    const u = getUser();
    return u?.email || u?.userId || null;
  }, []);

  useEffect(() => {
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
  }, []);

  const loadProgress = async () => {
    const currentUser = getUser();
    const currentUserId = currentUser?.email || currentUser?.userId;
    
    if (!currentUserId) {
      setError('User not found. Please log in again.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/api/users/${encodeURIComponent(currentUserId)}/courses`);
      const coursesData = Array.isArray(response.data) ? response.data : [];
      setCourses(coursesData);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load progress';
      setError(errorMessage);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const enrolledCourses = courses.filter(c => 
    c && (c.enrollmentStatus === 'enrolled' || c.enrollmentStatus === 'in_progress')
  );

  const completedCourses = courses.filter(c => 
    c && (c.completionStatus === 'completed' || c.completionStatus === 'passed')
  );

  // Courses to continue - both enrolled (not started) and in-progress (started but not completed)
  const continueCourses = enrolledCourses
    .filter(c => {
      const isCompleted = c.completionStatus === 'completed' || c.completionStatus === 'passed';
      return !isCompleted; // Include all non-completed courses
    })
    .sort((a, b) => {
      // Sort by progress (in-progress first, then by most recent)
      const progressA = a.progressPercent || 0;
      const progressB = b.progressPercent || 0;
      
      // Courses with progress come first
      if (progressA > 0 && progressB === 0) return -1;
      if (progressB > 0 && progressA === 0) return 1;
      
      // Then sort by latest activity (most recent first)
      const dateA = a.startedAt ? new Date(a.startedAt).getTime() : new Date(a.enrolledAt).getTime();
      const dateB = b.startedAt ? new Date(b.startedAt).getTime() : new Date(b.enrolledAt).getTime();
      return dateB - dateA;
    });

  // Group courses by category with statistics
  const groupedCourses = useMemo(() => {
    const groups: Record<string, {
      category: string;
      courses: CourseProgress[];
      stats: {
        total: number;
        completed: number;
        enrolled: number;
        inProgress: number;
      };
    }> = {};

    enrolledCourses.forEach((course) => {
      const category = course.category || "Uncategorized";
      
      if (!groups[category]) {
        groups[category] = {
          category,
          courses: [],
          stats: {
            total: 0,
            completed: 0,
            enrolled: 0,
            inProgress: 0,
          },
        };
      }

      groups[category].courses.push(course);
      groups[category].stats.total++;

      const isCompleted = course.completionStatus === 'completed' || course.completionStatus === 'passed';
      const isInProgress = course.completionStatus === 'in_progress' && 
        (course.progressPercent || 0) > 0 && 
        (course.progressPercent || 0) < 100;

      if (isCompleted) {
        groups[category].stats.completed++;
      }
      if (course.enrollmentStatus === 'enrolled' || course.enrollmentStatus === 'in_progress') {
        groups[category].stats.enrolled++;
      }
      if (isInProgress) {
        groups[category].stats.inProgress++;
      }
    });

    return Object.values(groups);
  }, [enrolledCourses]);

  const artifacts = getArtifacts();

  return (
    <>
      <Helmet>
        <title>Dashboard | Creative Learning</title>
        <meta name="description" content="Track your learning progress, view enrolled courses, and manage your learning journey." />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        {/* Hero Statement - "Lobby" Experience */}
        <HeroStatement />

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pb-8">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20 text-lg font-serif">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg font-serif">Loading your courses...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Category Statistics Overview - Individual Cards */}
                {groupedCourses.length > 0 && (
                  <div className="mb-16">
                    {groupedCourses.map((group, groupIndex) => (
                      <motion.div
                        key={group.category}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: groupIndex * 0.05 }}
                        className="mb-8"
                      >
                        {/* Individual Stat Cards */}
                        <div className="flex flex-wrap gap-4">
                          {/* Enrolled */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: groupIndex * 0.05 + 0.1 }}
                            className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex-1 min-w-[140px]"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen className="h-5 w-5 text-foreground" />
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enrolled</span>
                            </div>
                            <p className="text-3xl font-bold text-foreground">{group.stats.enrolled}</p>
                          </motion.div>

                          {/* In Progress */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: groupIndex * 0.05 + 0.15 }}
                            className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex-1 min-w-[140px]"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Play className="h-5 w-5 text-primary" />
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">In Progress</span>
                            </div>
                            <p className="text-3xl font-bold text-primary">{group.stats.inProgress}</p>
                          </motion.div>

                          {/* Completed */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: groupIndex * 0.05 + 0.2 }}
                            className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex-1 min-w-[140px]"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</span>
                            </div>
                            <p className="text-3xl font-bold text-green-600">{group.stats.completed}</p>
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Current Activity - Largest Visual Weight */}
                {continueCourses.length > 0 && (
                  <div className="mb-24">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-4xl font-serif font-semibold text-foreground mb-2">Continue Learning</h2>
                        <p className="text-lg text-muted-foreground font-serif">Your enrolled and in-progress courses</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/learner/courses">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {continueCourses.slice(0, 4).map((course) => {
                        if (!course) return null;
                        const progress = course.progressPercent !== undefined && course.progressPercent !== null
                          ? Math.max(0, Math.min(100, Number(course.progressPercent)))
                          : (course.score ? Math.max(0, Math.min(100, Number(course.score))) : 0);
                        
                        const isInProgress = progress > 0;
                        
                        return (
                          <Link
                            key={course.courseId}
                            to={`/learner/player/${course.courseId}`}
                            className="group"
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              whileHover={{ y: -4 }}
                              className="bg-muted/40 rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full"
                            >
                              {/* Course Image */}
                              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                                {course.thumbnailUrl ? (
                                  <img
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-muted">
                                    <div className="h-16 w-16 rounded-lg bg-foreground/5 flex items-center justify-center">
                                      <BookOpen className="h-8 w-8 text-foreground/10" />
                                    </div>
                                  </div>
                                )}
                                <div className="absolute top-3 right-3 z-10">
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs font-semibold shadow-lg backdrop-blur-md ${
                                      isInProgress
                                        ? "bg-primary/90 text-primary-foreground border-primary/50"
                                        : "bg-muted/90 text-foreground border-border/80"
                                    }`}
                                  >
                                    {isInProgress ? "In Progress" : "Enrolled"}
                                  </Badge>
                                </div>
                              </div>

                              {/* Course Info */}
                              <div className="flex-1 flex flex-col p-5">
                                <h3 className="font-serif font-semibold text-xl text-foreground group-hover:text-primary transition-colors line-clamp-2 tracking-normal flex-1 leading-relaxed mb-3">
                                  {course.title}
                                </h3>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm text-muted-foreground">Progress</span>
                                    <span className="text-sm font-medium text-foreground">{Math.round(progress)}%</span>
                                  </div>
                                  <Progress
                                    value={progress}
                                    className="h-1.5 bg-muted"
                                  />
                                </div>

                                {/* Action Button */}
                                <Button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `/learner/player/${course.courseId}`;
                                  }}
                                  className="w-full h-11 text-base font-medium transition-all duration-200 bg-foreground text-background hover:bg-foreground/90 shadow-sm hover:shadow-md"
                                >
                                  {isInProgress ? "Continue Learning" : "Start Learning"}
                                </Button>
                              </div>
                            </motion.div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Library/Archive - Hidden behind clean menu */}
                {completedCourses.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-4xl font-serif font-semibold text-foreground mb-4">
                      Completed
                    </h2>

                    <div className="mt-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
                        {completedCourses.map((course) => {
                        if (!course) return null;
                        const progress = course.progressPercent !== undefined && course.progressPercent !== null
                          ? Math.max(0, Math.min(100, Number(course.progressPercent)))
                          : (course.score ? Math.max(0, Math.min(100, Number(course.score))) : (course.completionStatus === 'completed' || course.completionStatus === 'passed' ? 100 : 0));
                        
                        const isCompleted = course.completionStatus === 'completed' || course.completionStatus === 'passed';
                        const isInProgress = course.completionStatus === 'in_progress' && progress > 0 && progress < 100;
                        
                        return (
                          <Link
                            key={course.courseId}
                            to={`/learner/player/${course.courseId}`}
                            className="group "
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              whileHover={{ y: -4 }}
                              className={`bg-muted/40 rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full ${
                                isCompleted 
                                  ? 'border-green-500/30 bg-green-500/10' 
                                  : isInProgress 
                                  ? 'border-primary/30 bg-primary/10' 
                                  : 'border-border/50'
                              }`}
                            >
                              {/* Course Image */}
                              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                                {course.thumbnailUrl ? (
                                  <img
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-muted">
                                    <div className="h-16 w-16 rounded-lg bg-foreground/5 flex items-center justify-center">
                                      <BookOpen className="h-8 w-8 text-foreground/10" />
                                    </div>
                                  </div>
                                )}
                                <div className="absolute top-3 right-3 z-10">
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs font-semibold shadow-lg backdrop-blur-md ${
                                      isCompleted
                                        ? "bg-success/90 text-success-foreground border-success/50"
                                        : isInProgress
                                        ? "bg-primary/90 text-primary-foreground border-primary/50"
                                        : "bg-muted/90 text-muted-foreground border-border/80 backdrop-blur-md"
                                    }`}
                                  >
                                    {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Enrolled"}
                                  </Badge>
                                </div>
                              </div>

                              {/* Course Info */}
                              <div className="flex-1 flex flex-col p-5">
                                <h3 className="font-serif font-semibold text-sm sm:text-base md:text-lg lg:text-xl text-foreground group-hover:text-primary transition-all duration-300 line-clamp-2 flex-1 leading-relaxed mb-4">
                                  {course.title}
                                </h3>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-base text-muted-foreground font-serif">Progress</span>
                                    <span className="text-base font-medium text-foreground font-serif">{Math.round(progress)}%</span>
                                  </div>
                                  <Progress
                                    value={progress}
                                    className="h-1.5 bg-muted"
                                  />
                                </div>

                                {/* Action Button */}
                                <Button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `/learner/player/${course.courseId}`;
                                  }}
                                  className={`w-full h-11 text-base font-medium transition-all duration-200 ${
                                    isCompleted
                                      ? "bg-foreground/10 text-foreground hover:bg-foreground/20 border border-border"
                                      : "bg-foreground text-background hover:bg-foreground/90 shadow-sm hover:shadow-md"
                                  }`}
                                >
                                  {isCompleted ? "Review Course" : "Continue Learning"}
                                </Button>
                              </div>
                            </motion.div>
                          </Link>
                        );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {enrolledCourses.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <Sparkles className="h-10 w-10 text-primary/50" />
                    </div>
                    <h3 className="text-3xl font-serif font-semibold text-foreground mb-2">Start Your Learning Journey</h3>
                    <p className="text-lg text-muted-foreground mb-6 max-w-md mx-auto font-serif">
                      You haven't enrolled in any courses yet. Browse our catalog to find courses that interest you.
                    </p>
                    <Button size="lg" asChild>
                      <Link to="/learner/courses">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Browse Courses
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Artifact Collection */}
                {artifacts.length > 0 && (
                  <div className="mt-16">
                    <ArtifactCollection artifacts={artifacts} />
                  </div>
                )}

                {/* Achievement Section */}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProgressDashboard;
