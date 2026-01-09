import { useEffect, useState, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  Play,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

  const inProgressCourses = enrolledCourses.filter(c => 
    c.completionStatus === 'in_progress' && 
    (c.progressPercent || 0) > 0 && 
    (c.progressPercent || 0) < 100
  );

  const totalTimeSpent = courses.reduce((acc, c) => acc + (c.timeSpent || 0), 0);
  const hoursLearned = Math.round(totalTimeSpent / 3600 * 10) / 10;

  return (
    <>
      <Helmet>
        <title>Dashboard | Creative Learning</title>
        <meta name="description" content="Track your learning progress, view enrolled courses, and manage your learning journey." />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="px-8 py-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
              </h1>
              <p className="text-muted-foreground mt-1">
                Continue your learning journey
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/courses">
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Courses
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p>Loading your courses...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Quick Stats */}
                {enrolledCourses.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Active Courses</p>
                          <p className="text-2xl font-bold text-foreground">{inProgressCourses.length}</p>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-gradient-navy flex items-center justify-center shadow-glow">
                          <Play className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-accent/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Completed</p>
                          <p className="text-2xl font-bold text-foreground">{completedCourses.length}</p>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-accent/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-accent" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Learning Time</p>
                          <p className="text-2xl font-bold text-foreground">{hoursLearned}h</p>
                        </div>
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Continue Learning Section */}
                {inProgressCourses.length > 0 && (
                  <div className="mb-16 bg-card rounded-xl border border-border/50 p-6 shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-gradient-navy">Continue Learning</h2>
                        <p className="text-sm text-muted-foreground mt-1">Pick up where you left off</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/courses">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
                      {inProgressCourses.slice(0, 6).map((course) => {
                        if (!course) return null;
                        const progress = course.progressPercent !== undefined && course.progressPercent !== null
                          ? Math.max(0, Math.min(100, Number(course.progressPercent)))
                          : (course.score ? Math.max(0, Math.min(100, Number(course.score))) : 0);
                        
                        return (
                          <Link
                            key={course.courseId}
                            to={`/player/${course.courseId}`}
                            className="group"
                          >
                            <div className="bg-background rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-300 h-full flex flex-col w-full">
                              {course.thumbnailUrl ? (
                                <div className="relative w-full h-40 overflow-hidden">
                                  <img
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                  <BookOpen className="h-10 w-10 text-primary/30" />
                                </div>
                              )}
                              <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-semibold text-sm text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                  {course.title}
                                </h3>
                                <div className="mt-auto space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Progress</span>
                                    <Badge className="bg-primary/90 text-primary-foreground text-xs">
                                      {progress}%
                                    </Badge>
                                  </div>
                                  <Progress value={progress} className="h-2" />
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Divider between sections */}
                {inProgressCourses.length > 0 && enrolledCourses.length > 0 && (
                  <div className="mb-12 flex items-center gap-4">
                    <div className="flex-1 h-px bg-border/50"></div>
                    <div className="h-1 w-1 rounded-full bg-border"></div>
                    <div className="flex-1 h-px bg-border/50"></div>
                  </div>
                )}

                {/* All Enrolled Courses */}
                {enrolledCourses.length > 0 && (
                  <div className="mb-8 bg-card rounded-xl border border-border/50 p-6 shadow-md hover:shadow-lg transition-shadow duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-gradient-teal">My Courses</h2>
                        <p className="text-sm text-muted-foreground mt-1">All your enrolled courses</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/courses">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
                      {enrolledCourses.map((course) => {
                        if (!course) return null;
                        const progress = course.progressPercent !== undefined && course.progressPercent !== null
                          ? Math.max(0, Math.min(100, Number(course.progressPercent)))
                          : (course.score ? Math.max(0, Math.min(100, Number(course.score))) : (course.completionStatus === 'completed' || course.completionStatus === 'passed' ? 100 : 0));
                        
                        const isCompleted = course.completionStatus === 'completed' || course.completionStatus === 'passed';
                        const isInProgress = course.completionStatus === 'in_progress' && progress > 0 && progress < 100;
                        
                        return (
                          <Link
                            key={course.courseId}
                            to={`/player/${course.courseId}`}
                            className="group "
                          >
                            <div className={`bg-card rounded-xl border overflow-hidden hover:shadow-md transition-all duration-300 h-full flex flex-col w-full ${
                              isCompleted 
                                ? 'border-green-500/30' 
                                : isInProgress 
                                ? 'border-primary/30' 
                                : 'border-border/50'
                            }`}>
                              {course.thumbnailUrl ? (
                                <div className="relative w-full h-40 overflow-hidden">
                                  <img
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  {isCompleted && (
                                    <div className="absolute top-2 right-2">
                                      <Badge className="bg-green-500 text-white text-xs">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Done
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative">
                                  <BookOpen className="h-10 w-10 text-primary/30" />
                                  {isCompleted && (
                                    <div className="absolute top-2 right-2">
                                      <Badge className="bg-green-500 text-white text-xs">
                                        <Trophy className="h-3 w-3 mr-1" />
                                        Done
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-semibold text-sm text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                  {course.title}
                                </h3>
                                {course.description && (
                                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                    {course.description}
                                  </p>
                                )}
                                <div className="mt-auto space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Progress</span>
                                    {isInProgress && (
                                      <Badge className="bg-primary/90 text-primary-foreground text-xs">
                                        {progress}%
                                      </Badge>
                                    )}
                                  </div>
                                  <Progress 
                                    value={progress} 
                                    className={`h-2 ${
                                      isCompleted ? 'bg-green-500/20' : 
                                      isInProgress ? 'bg-primary/20' : ''
                                    }`}
                                  />
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-muted-foreground">
                                      {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'}
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {enrolledCourses.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <Sparkles className="h-10 w-10 text-primary/50" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Start Your Learning Journey</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      You haven't enrolled in any courses yet. Browse our catalog to find courses that interest you.
                    </p>
                    <Button size="lg" asChild>
                      <Link to="/courses">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Browse Courses
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Achievement Section */}
                {completedCourses.length > 0 && (
                  <div className="mt-8 bg-gradient-navy rounded-xl p-6 border border-primary/30 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-teal-glow">
                        <Trophy className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1">
                          {completedCourses.length} {completedCourses.length === 1 ? 'Course' : 'Courses'} Completed!
                        </h3>
                        <p className="text-sm text-white/90">
                          Great progress! Keep up the excellent work.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProgressDashboard;
