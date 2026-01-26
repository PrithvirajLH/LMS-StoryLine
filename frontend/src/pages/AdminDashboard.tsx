import { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { 
  BookOpen, Users, Trophy, Clock, 
  ChevronLeft, ChevronRight, Award, Activity
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "../services/api";
import { getUser } from "../services/auth";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

interface Course {
  courseId: string;
  title: string;
  enrollmentCount: number;
  attemptCount: number;
}

interface LearnerProgress {
  userId: string;
  courseId: string;
  courseTitle?: string;
  enrollmentStatus: string;
  completionStatus?: string;
  progressPercent?: number;
  timeSpent?: number;
  enrolledAt?: string;
  startedAt?: string;
  completedAt?: string;
}

interface Attempt {
  registrationId: string;
  userEmail: string;
  userName?: string;
  courseId: string;
  courseTitle?: string;
  completionStatus?: string;
  completionVerb?: string;
  completionStatementId?: string;
  score?: number;
  success?: boolean | null;
  progressPercent?: number | null;
  timeSpent?: number;
  launchedAt?: string;
  completedAt?: string;
  eligibleForRaise?: boolean | null;
}

export default function AdminDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptPage, setAttemptPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesResponse, progressResponse, attemptsResponse] = await Promise.all([
        api.get('/api/admin/courses'),
        api.get('/api/admin/progress'),
        api.get('/api/admin/attempts')
      ]);
      setCourses(coursesResponse.data);
      setProgress(progressResponse.data);
      setAttempts(attemptsResponse.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || errorMessage);
      toast.error(axiosError.response?.data?.error || errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Statistics calculations
  const stats = useMemo(() => {
    const totalLearners = new Set(progress.map(p => p.userId)).size;
    const totalEnrollments = progress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length;
    const totalCompletions = progress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length;
    const completionRate = totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;
    const avgTimeSpent = progress.length > 0 
      ? Math.round(progress.reduce((acc, p) => acc + (p.timeSpent || 0), 0) / progress.length / 60)
      : 0;
    const inProgressCount = progress.filter(p => p.completionStatus === 'in_progress').length;
    
    return {
      totalCourses: courses.length,
      totalLearners,
      totalEnrollments,
      totalCompletions,
      completionRate,
      avgTimeSpent,
      inProgressCount,
    };
  }, [courses, progress]);

  // Chart data calculations
  const chartData = useMemo(() => {
    const courseData = courses.map((course) => {
      const courseProgress = progress.filter(p => p.courseId === course.courseId);
      const enrolled = courseProgress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length;
      const completed = courseProgress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length;
      const inProgress = courseProgress.filter(p => p.completionStatus === 'in_progress').length;
      const completionRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;

      return {
        name: course.title.length > 15 ? course.title.substring(0, 15) + '...' : course.title,
        fullName: course.title,
        enrolled,
        completed,
        inProgress,
        completionRate,
      };
    }).sort((a, b) => b.enrolled - a.enrolled);

    const enrollmentStatusData = [
      { name: 'Completed', value: progress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length, color: '#10b981' }, // Emerald
      { name: 'In Progress', value: progress.filter(p => p.enrollmentStatus === 'in_progress' || p.completionStatus === 'in_progress').length, color: '#f59e0b' }, // Amber
      { name: 'Enrolled', value: progress.filter(p => p.enrollmentStatus === 'enrolled').length, color: '#6366f1' }, // Indigo
    ].filter(d => d.value > 0);

    // Enrollment trends
    const enrollmentTrends: { [key: string]: { enrollments: number; completions: number } } = {};
    progress.forEach(p => {
      if (p.enrolledAt) {
        const date = new Date(p.enrolledAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!enrollmentTrends[monthKey]) enrollmentTrends[monthKey] = { enrollments: 0, completions: 0 };
        enrollmentTrends[monthKey].enrollments++;
      }
      if (p.completedAt) {
        const date = new Date(p.completedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!enrollmentTrends[monthKey]) enrollmentTrends[monthKey] = { enrollments: 0, completions: 0 };
        enrollmentTrends[monthKey].completions++;
      }
    });

    const trendData = Object.entries(enrollmentTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
        ...data,
      }));

    // Radial data for completion rate
    const radialData = [{ name: 'Completion', value: stats.completionRate, fill: '#10b981' }]; // Emerald

    return { courseData, enrollmentStatusData, trendData, radialData };
  }, [courses, progress, stats.completionRate]);

  const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const attemptsPerPage = 10;
  const attemptPageCount = Math.max(1, Math.ceil(attempts.length / attemptsPerPage));
  const pagedAttempts = useMemo(() => {
    const start = (attemptPage - 1) * attemptsPerPage;
    return attempts.slice(start, start + attemptsPerPage);
  }, [attempts, attemptPage]);

  useEffect(() => {
    if (attemptPage > attemptPageCount) setAttemptPage(1);
  }, [attempts, attemptPage, attemptPageCount]);

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  // Primary color for the theme
  const primaryColor = '#881337'; // Dark rose/maroon

  return (
    <>
      <Helmet>
        <title>Dashboard | Creative Learning Admin</title>
        <meta name="description" content="Admin dashboard overview with statistics and analytics." />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="macro-padding py-8">
            <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-2">
              Learning Analytics
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              Track learner progress, monitor completions, and manage courses
            </p>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pt-6 pb-8">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20 text-lg font-serif">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg font-serif">Loading analytics data...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Stats Cards - Compact */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Total Courses */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <BookOpen className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-foreground leading-none">{stats.totalCourses}</p>
                            <p className="text-base text-muted-foreground mt-1">Courses</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Active Learners */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-foreground leading-none">{stats.totalLearners}</p>
                            <p className="text-base text-muted-foreground mt-1">Learners</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Completions */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Trophy className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-foreground leading-none">{stats.totalCompletions}</p>
                            <p className="text-base text-muted-foreground mt-1">Completions</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Avg Time */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Clock className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-foreground leading-none">{stats.avgTimeSpent}<span className="text-base text-muted-foreground">m</span></p>
                            <p className="text-base text-muted-foreground mt-1">Avg Time</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Charts Row - All 4 in one line */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ minHeight: '320px' }}>
                  {/* Completion Rate */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm h-full">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <Activity className="h-5 w-5" style={{ color: primaryColor }} />
                          Completion Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="h-52 relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                              cx="50%"
                              cy="50%"
                              innerRadius="50%"
                              outerRadius="80%"
                              data={chartData.radialData}
                              startAngle={90}
                              endAngle={-270}
                              barSize={12}
                            >
                              <PolarAngleAxis
                                type="number"
                                domain={[0, 100]}
                                angleAxisId={0}
                                tick={false}
                              />
                              <RadialBar
                                background={{ fill: '#e5e7eb' }}
                                dataKey="value"
                                cornerRadius={6}
                                fill="#10b981"
                                angleAxisId={0}
                              />
                            </RadialBarChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <span className="text-3xl font-bold text-emerald-600 leading-none">{stats.completionRate}%</span>
                            <span className="text-sm text-muted-foreground leading-none">Complete</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Activity Trends */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm h-full">
                      <CardHeader className="p-4 pb-1">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Activity className="h-5 w-5 text-amber-600" />
                            Activity Trends
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-3 text-sm mt-1">
                          <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span className="text-muted-foreground">Enrollments</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-muted-foreground">Completions</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={chartData.trendData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={25} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '8px',
                                fontSize: '12px'
                              }} 
                            />
                            <Bar dataKey="enrollments" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="completions" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Status Distribution */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm h-full">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <Activity className="h-5 w-5 text-indigo-600" />
                          Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="flex flex-col items-center">
                          <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                              <Pie
                                data={chartData.enrollmentStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {chartData.enrollmentStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'white', 
                                  border: '1px solid #e2e8f0', 
                                  borderRadius: '8px',
                                  fontSize: '12px'
                                }} 
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex flex-wrap justify-center gap-3 mt-1">
                            {chartData.enrollmentStatusData.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-sm">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-muted-foreground">{item.name}</span>
                                <span className="font-semibold">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Course Performance - Horizontal Bar Chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm h-full">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-cyan-600" />
                          Course Performance
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart 
                            data={chartData.courseData.slice(0, 5)} 
                            layout="vertical"
                            barGap={2}
                            margin={{ left: 0, right: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis 
                              type="number"
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748b', fontSize: 10 }}
                            />
                            <YAxis 
                              type="category"
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748b', fontSize: 9 }}
                              width={90}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
                                      <p className="font-semibold mb-1 text-slate-900">{data.fullName}</p>
                                      <p className="text-cyan-600">Enrolled: <span className="font-medium">{data.enrolled}</span></p>
                                      <p className="text-emerald-600">Completed: <span className="font-medium">{data.completed}</span></p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="enrolled" fill="#0891b2" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Course Details Table */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="bg-muted/40 border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-xl font-serif font-semibold flex items-center gap-2">
                        <BookOpen className="h-5 w-5" style={{ color: primaryColor }} />
                        Course Details
                      </CardTitle>
                      <CardDescription className="text-base font-serif">
                        Enrollment and completion statistics per course
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                              <TableHead className="text-base font-semibold text-foreground">Course</TableHead>
                              <TableHead className="text-base font-semibold text-foreground text-center">Enrolled</TableHead>
                              <TableHead className="text-base font-semibold text-foreground text-center">Completed</TableHead>
                              <TableHead className="text-base font-semibold text-foreground text-center">In Progress</TableHead>
                              <TableHead className="text-base font-semibold text-foreground">Completion Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {chartData.courseData.map((course, idx) => (
                              <TableRow key={idx} className="hover:bg-muted/50 transition-colors border-b border-border">
                                <TableCell className="text-base font-medium">{course.fullName}</TableCell>
                                <TableCell className="text-base text-center">{course.enrolled}</TableCell>
                                <TableCell className="text-base text-center">{course.completed}</TableCell>
                                <TableCell className="text-base text-center">{course.inProgress}</TableCell>
                                <TableCell className="text-base text-center">
                                  <span className={`font-medium ${
                                    course.completionRate >= 70 ? 'text-emerald-600' :
                                    course.completionRate >= 40 ? 'text-amber-600' : 'text-muted-foreground'
                                  }`}>
                                    {course.completionRate}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                            {courses.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-base text-muted-foreground py-8">
                                  No courses available
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Latest Activity Table */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                >
                  <Card className="bg-muted/40 border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-serif font-semibold flex items-center gap-2">
                          <Activity className="h-5 w-5" style={{ color: primaryColor }} />
                          Latest Activity
                        </CardTitle>
                        <CardDescription className="text-base font-serif">
                          Recent learner enrollments and completions
                        </CardDescription>
                      </div>
                      {attempts.length > attemptsPerPage && (
                        <div className="flex items-center gap-2">
                          <span className="text-base text-muted-foreground">
                            {attemptPage} / {attemptPageCount}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setAttemptPage(prev => Math.max(1, prev - 1))}
                              disabled={attemptPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setAttemptPage(prev => Math.min(attemptPageCount, prev + 1))}
                              disabled={attemptPage === attemptPageCount}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                              <TableHead className="text-base font-semibold text-foreground">Learner</TableHead>
                              <TableHead className="text-base font-semibold text-foreground">Course</TableHead>
                              <TableHead className="text-base font-semibold text-foreground">Status</TableHead>
                              <TableHead className="text-base font-semibold text-foreground text-center">
                                <Award className="h-4 w-4 inline mr-1" />
                                Eligible
                              </TableHead>
                              <TableHead className="text-base font-semibold text-foreground">Completed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pagedAttempts.map((attempt) => (
                              <TableRow key={attempt.registrationId} className="hover:bg-muted/50 transition-colors border-b border-border">
                                <TableCell className="text-base">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      {(attempt.userName || attempt.userEmail)?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <span className="font-medium">{attempt.userName || attempt.userEmail}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-base max-w-[200px] truncate">{attempt.courseTitle || attempt.courseId}</TableCell>
                                <TableCell className="text-base">
                                  <Badge
                                    className={
                                      attempt.completionStatus === 'completed' || attempt.completionStatus === 'passed'
                                        ? 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200'
                                        : attempt.completionStatus === 'in_progress'
                                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200'
                                        : attempt.completionStatus === 'failed'
                                        ? 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200'
                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200'
                                    }
                                  >
                                    {attempt.completionStatus || 'Pending'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-base text-center">
                                  {attempt.eligibleForRaise === true ? (
                                    <Badge className="bg-green-600 text-white hover:bg-green-600">Yes</Badge>
                                  ) : attempt.eligibleForRaise === false ? (
                                    <Badge variant="outline" className="text-muted-foreground">No</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-base text-muted-foreground">{formatDate(attempt.completedAt)}</TableCell>
                              </TableRow>
                            ))}
                            {attempts.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-base text-muted-foreground py-8">
                                  No activity data available
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
