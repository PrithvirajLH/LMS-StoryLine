import { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { BookOpen, Users, UserPlus, Trophy, BarChart3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "../services/api";
import { getUser } from "../services/auth";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data');
      toast.error(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Chart data calculations
  const chartData = useMemo(() => {
    // Course enrollment and completion data
    const courseData = courses.map((course) => {
      const courseProgress = progress.filter(p => p.courseId === course.courseId);
      const enrolled = courseProgress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length;
      const completed = courseProgress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length;
      const inProgress = courseProgress.filter(p => p.completionStatus === 'in_progress').length;
      const completionRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
      const avgTimeSpent = courseProgress.length > 0
        ? Math.round(courseProgress.reduce((acc, p) => acc + (p.timeSpent || 0), 0) / courseProgress.length / 60)
        : 0;

      return {
        name: course.title.length > 20 ? course.title.substring(0, 20) + '...' : course.title,
        fullName: course.title,
        enrolled,
        completed,
        inProgress,
        completionRate,
        avgTimeSpent,
      };
    }).sort((a, b) => b.enrolled - a.enrolled);

    // Enrollment status distribution
    const enrollmentStatusData = [
      {
        name: 'Enrolled',
        value: progress.filter(p => p.enrollmentStatus === 'enrolled').length,
        color: '#3b82f6',
      },
      {
        name: 'In Progress',
        value: progress.filter(p => p.enrollmentStatus === 'in_progress' || p.completionStatus === 'in_progress').length,
        color: '#f59e0b',
      },
      {
        name: 'Completed',
        value: progress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length,
        color: '#10b981',
      },
      {
        name: 'Not Started',
        value: progress.filter(p => !p.completionStatus || p.completionStatus === 'not_started').length,
        color: '#6b7280',
      },
    ];

    // Progress distribution
    const progressRanges = [
      { name: '0-25%', min: 0, max: 25, color: '#ef4444' },
      { name: '26-50%', min: 26, max: 50, color: '#f59e0b' },
      { name: '51-75%', min: 51, max: 75, color: '#3b82f6' },
      { name: '76-99%', min: 76, max: 99, color: '#8b5cf6' },
      { name: '100%', min: 100, max: 100, color: '#10b981' },
    ];

    const progressDistribution = progressRanges.map(range => {
      const count = progress.filter(p => {
        const percent = p.progressPercent || 0;
        if (range.min === 100) return percent === 100;
        return percent >= range.min && percent < range.max;
      }).length;
      return {
        name: range.name,
        value: count,
        color: range.color,
      };
    });

    // Enrollment trends (by month)
    const enrollmentTrends: { [key: string]: number } = {};
    progress.forEach(p => {
      if (p.enrolledAt) {
        const date = new Date(p.enrolledAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        enrollmentTrends[monthKey] = (enrollmentTrends[monthKey] || 0) + 1;
      }
    });

    const enrollmentTrendData = Object.entries(enrollmentTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        enrollments: count,
      }));

    // Completion trends
    const completionTrends: { [key: string]: number } = {};
    progress.forEach(p => {
      if (p.completedAt) {
        const date = new Date(p.completedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        completionTrends[monthKey] = (completionTrends[monthKey] || 0) + 1;
      }
    });

    const completionTrendData = Object.entries(completionTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        completions: count,
      }));

    // Combine enrollment and completion trends
    const combinedTrendData = enrollmentTrendData.map(item => {
      const completionItem = completionTrendData.find(c => c.month === item.month);
      return {
        month: item.month,
        enrollments: item.enrollments,
        completions: completionItem?.completions || 0,
      };
    });

    // Average time spent by course
    const timeSpentData = courseData
      .filter(c => c.avgTimeSpent > 0)
      .sort((a, b) => b.avgTimeSpent - a.avgTimeSpent)
      .slice(0, 10);

    return {
      courseData,
      enrollmentStatusData,
      progressDistribution,
      combinedTrendData,
      timeSpentData,
    };
  }, [courses, progress]);

  const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];
  const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-US') : '—';
  const attemptsPerPage = 25;
  const attemptPageCount = Math.max(1, Math.ceil(attempts.length / attemptsPerPage));
  const pagedAttempts = useMemo(() => {
    const start = (attemptPage - 1) * attemptsPerPage;
    return attempts.slice(start, start + attemptsPerPage);
  }, [attempts, attemptPage]);

  useEffect(() => {
    if (attemptPage > attemptPageCount) {
      setAttemptPage(1);
    }
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

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | Creative Learning</title>
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
          <div className="px-8 py-8">
            <div className="mb-6">
              <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-4 flex items-center gap-3">
                <div 
                  className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #FF6B9D, #C44569)'
                  }}
                >
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground text-lg font-serif">Overview of your learning management system</p>
            </div>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pb-24">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20 text-lg font-serif">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg font-serif">Loading dashboard data...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                  {/* Total Courses */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-serif">Total Courses</p>
                            <p className="text-4xl font-serif font-bold text-foreground">{courses.length}</p>
                          </div>
                          <div 
                            className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                            style={{
                              background: 'linear-gradient(135deg, #FF6B9D, #C44569, #8B5FBF)'
                            }}
                          >
                            <BookOpen className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Total Learners */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-serif">Total Learners</p>
                            <p className="text-4xl font-serif font-bold text-foreground">
                              {new Set(progress.map(p => p.userId)).size}
                            </p>
                          </div>
                          <div 
                            className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                            style={{
                              background: 'linear-gradient(135deg, #4ECDC4, #44A08D)'
                            }}
                          >
                            <Users className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Total Enrollments */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-serif">Total Enrollments</p>
                            <p className="text-4xl font-serif font-bold text-foreground">
                              {progress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length}
                            </p>
                          </div>
                          <div 
                            className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                            style={{
                              background: 'linear-gradient(135deg, #8B5FBF, #C44569)'
                            }}
                          >
                            <UserPlus className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Total Completions */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-serif">Total Completions</p>
                            <p className="text-4xl font-serif font-bold text-foreground">
                              {progress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length}
                            </p>
                          </div>
                          <div 
                            className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                            style={{
                              background: 'linear-gradient(135deg, #4ECDC4, #44A08D)'
                            }}
                          >
                            <Trophy className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Charts Section */}
                {chartData.courseData.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
                    {/* Course Enrollment Comparison */}
                    <Card className="bg-muted/40 border-border">
                      <CardHeader>
                        <CardTitle className="text-xl font-serif font-semibold">Course Enrollment</CardTitle>
                        <CardDescription className="font-serif">Number of learners enrolled per course</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData.courseData.slice(0, 8)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            fontSize={12}
                          />
                          <YAxis />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                    <p className="font-semibold mb-2">{data.fullName}</p>
                                    <p className="text-sm">Enrolled: <span className="font-medium">{data.enrolled}</span></p>
                                    <p className="text-sm">Completed: <span className="font-medium">{data.completed}</span></p>
                                    <p className="text-sm">In Progress: <span className="font-medium">{data.inProgress}</span></p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="enrolled" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Completion Rate by Course */}
                  <Card className="bg-muted/40 border-border">
                    <CardHeader>
                      <CardTitle className="text-xl font-serif font-semibold">Completion Rate by Course</CardTitle>
                      <CardDescription className="font-serif">Percentage of enrolled learners who completed</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData.courseData.slice(0, 8)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            fontSize={12}
                          />
                          <YAxis domain={[0, 100]} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                    <p className="font-semibold mb-2">{data.fullName}</p>
                                    <p className="text-sm">Completion Rate: <span className="font-medium">{data.completionRate}%</span></p>
                                    <p className="text-sm">Completed: <span className="font-medium">{data.completed}</span> / {data.enrolled}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="completionRate" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Enrollment Status Distribution */}
                  <Card className="bg-muted/40 border-border">
                    <CardHeader>
                      <CardTitle className="text-xl font-serif font-semibold">Enrollment Status Distribution</CardTitle>
                      <CardDescription className="font-serif">Breakdown of learner enrollment status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={chartData.enrollmentStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {chartData.enrollmentStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Progress Distribution */}
                  <Card className="bg-muted/40 border-border">
                    <CardHeader>
                      <CardTitle className="text-xl font-serif font-semibold">Progress Distribution</CardTitle>
                      <CardDescription className="font-serif">Distribution of learners by progress percentage</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={chartData.progressDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent, value }) => value > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {chartData.progressDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Enrollment & Completion Trends */}
                  <Card className="lg:col-span-2 bg-muted/40 border-border">
                    <CardHeader>
                      <CardTitle className="text-xl font-serif font-semibold">Enrollment & Completion Trends</CardTitle>
                      <CardDescription className="font-serif">Monthly enrollment and completion trends over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData.combinedTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Area 
                            type="monotone" 
                            dataKey="enrollments" 
                            stackId="1"
                            stroke="#3b82f6" 
                            fill="#3b82f6" 
                            fillOpacity={0.6}
                            name="Enrollments"
                          />
                          <Area 
                            type="monotone" 
                            dataKey="completions" 
                            stackId="2"
                            stroke="#10b981" 
                            fill="#10b981" 
                            fillOpacity={0.6}
                            name="Completions"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Average Time Spent by Course */}
                  <Card className="lg:col-span-2 bg-muted/40 border-border">
                    <CardHeader>
                      <CardTitle className="text-xl font-serif font-semibold">Average Time Spent by Course</CardTitle>
                      <CardDescription className="font-serif">Average learning time (minutes) per course</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart 
                          data={chartData.timeSpentData}
                          layout="vertical"
                          margin={{ left: 20, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={150}
                            fontSize={12}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                    <p className="font-semibold mb-2">{data.fullName}</p>
                                    <p className="text-sm">Avg Time: <span className="font-medium">{data.avgTimeSpent} minutes</span></p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="avgTimeSpent" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  </div>
                ) : (
                  <Card className="mb-16 bg-muted/40 border-border">
                    <CardContent className="p-12 text-center">
                      <p className="text-lg text-muted-foreground font-serif">No data available for charts. Create courses and enroll learners to see analytics.</p>
                    </CardContent>
                  </Card>
                )}

                {/* Course Statistics Table */}
                <Card className="bg-muted/40 border-border">
                  <CardHeader>
                    <CardTitle className="text-xl font-serif font-semibold">Course Statistics</CardTitle>
                    <CardDescription className="font-serif">Detailed overview of enrollment and completion by course</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead>Enrolled</TableHead>
                          <TableHead>Completed</TableHead>
                          <TableHead>In Progress</TableHead>
                          <TableHead>Completion Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartData.courseData.map((course) => (
                          <TableRow key={course.fullName}>
                            <TableCell className="font-medium">{course.fullName}</TableCell>
                            <TableCell>{course.enrolled}</TableCell>
                            <TableCell>{course.completed}</TableCell>
                            <TableCell>{course.inProgress}</TableCell>
                            <TableCell>
                              <span className={course.completionRate >= 70 ? 'text-green-600 dark:text-green-400' : course.completionRate >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}>
                                {course.completionRate}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {courses.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No courses available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Attempt Audit Table */}
                <Card className="bg-muted/40 border-border mt-10">
                  <CardHeader>
                    <CardTitle className="text-xl font-serif font-semibold">Attempt Audit Trail</CardTitle>
                    <CardDescription className="font-serif">Registration-level completion evidence for payroll accuracy</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Learner</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Success</TableHead>
                          <TableHead>Eligible</TableHead>
                          <TableHead>Completed</TableHead>
                          <TableHead>Registration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedAttempts.map((attempt) => (
                          <TableRow key={attempt.registrationId}>
                            <TableCell className="font-medium">
                              {attempt.userName || attempt.userEmail}
                            </TableCell>
                            <TableCell>{attempt.courseTitle || attempt.courseId}</TableCell>
                            <TableCell>{attempt.completionStatus || '—'}</TableCell>
                            <TableCell>{attempt.score ?? '—'}</TableCell>
                            <TableCell>
                              {typeof attempt.success === 'boolean' ? (attempt.success ? 'Yes' : 'No') : '—'}
                            </TableCell>
                            <TableCell>
                              {attempt.eligibleForRaise === true ? 'Yes' : attempt.eligibleForRaise === false ? 'No' : '—'}
                            </TableCell>
                            <TableCell>{formatDate(attempt.completedAt)}</TableCell>
                            <TableCell className="font-mono text-xs">{attempt.registrationId}</TableCell>
                          </TableRow>
                        ))}
                        {attempts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                              No attempt data available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {attempts.length > attemptsPerPage && (
                      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                        <span>Page {attemptPage} of {attemptPageCount}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAttemptPage(prev => Math.max(1, prev - 1))}
                            disabled={attemptPage === 1}
                          >
                            Prev
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAttemptPage(prev => Math.min(attemptPageCount, prev + 1))}
                            disabled={attemptPage === attemptPageCount}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
