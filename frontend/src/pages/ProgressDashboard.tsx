import { useEffect, useState } from "react";
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
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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
  timeSpent?: string;
  enrolledAt: string;
  startedAt?: string;
  completedAt?: string;
}

const ProgressDashboard = () => {
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/users/${user?.userId}/courses`);
      setCourses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const enrolledCourses = courses.filter(c => c.enrollmentStatus === 'enrolled' || c.enrollmentStatus === 'in_progress');
  
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
      value: courses.reduce((acc, c) => acc + (parseFloat(c.timeSpent?.replace(' hours', '') || '0')), 0).toFixed(0), 
      color: "text-info" 
    },
    { 
      icon: Trophy, 
      label: "Certificates", 
      value: courses.filter(c => c.completionStatus === 'completed' || c.completionStatus === 'passed').length.toString(), 
      color: "text-accent" 
    },
    { 
      icon: TrendingUp, 
      label: "In Progress", 
      value: courses.filter(c => c.completionStatus === 'in_progress').length.toString(), 
      color: "text-success" 
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard | Creative Learning</title>
        <meta name="description" content="Track your learning progress, view enrolled courses, and manage your learning journey." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 lg:px-8">
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

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm"
                >
                  <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
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
                    <p className="text-muted-foreground">Loading courses...</p>
                  </div>
                ) : enrolledCourses.length > 0 ? (
                  <div className="space-y-4">
                    {enrolledCourses.map((course) => {
                      // Use progressPercent from database (preferred) or fallback to score/completion
                      const progress = course.progressPercent !== undefined 
                        ? course.progressPercent 
                        : (course.score || (course.completionStatus === 'completed' || course.completionStatus === 'passed' ? 100 : 0));
                      return (
                        <Link
                          key={course.courseId}
                          to={`/player/${course.courseId}`}
                          className="block"
                        >
                          <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group">
                            <div className="flex gap-4">
                              {course.thumbnailUrl ? (
                                <img
                                  src={course.thumbnailUrl}
                                  alt={course.title}
                                  className="w-24 h-24 md:w-32 md:h-20 rounded-xl object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-24 h-24 md:w-32 md:h-20 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground mb-1 truncate group-hover:text-primary transition-colors">
                                  {course.title}
                                </h3>
                                {course.description && (
                                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                    {course.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3">
                                  <Progress value={progress} className="h-2 flex-1" />
                                  <span className="text-sm font-medium text-primary">
                                    {progress}%
                                  </span>
                                </div>
                              </div>
                              <div className="hidden md:flex items-center">
                                <Button variant="ghost" size="icon">
                                  <ChevronRight className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl p-8 text-center border border-border/50">
                    <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet.</p>
                    <Button variant="hero" asChild>
                      <Link to="/courses">Browse Courses</Link>
                    </Button>
                  </div>
                )}

                {/* Empty state CTA */}
                {enrolledCourses.length > 0 && (
                  <div className="mt-8 bg-primary/5 rounded-2xl p-8 text-center border border-primary/10">
                    <h3 className="font-semibold text-foreground mb-2">
                      Ready to learn something new?
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Explore our catalog and find your next course
                    </p>
                    <Button variant="hero" asChild>
                      <Link to="/courses">Browse Courses</Link>
                    </Button>
                  </div>
                )}
              </motion.div>

              {/* Sidebar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                {/* Recent Activity */}
                <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                  <h3 className="font-semibold text-foreground mb-4">Recent Activity</h3>
                  {courses.length > 0 ? (
                    <div className="space-y-4">
                      {courses.slice(0, 3).map((course, index) => (
                        <div
                          key={course.courseId}
                          className="flex items-start gap-3 pb-4 border-b border-border/50 last:border-0 last:pb-0"
                        >
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-foreground">
                              <span className="font-medium">
                                {course.completionStatus === 'completed' ? 'Completed' : 
                                 course.completionStatus === 'in_progress' ? 'In Progress' : 
                                 'Enrolled in'}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {course.title}
                            </p>
                            {course.enrolledAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(course.enrolledAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
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
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ProgressDashboard;
