import { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { BookOpen, Users, UserPlus, Trophy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesResponse, progressResponse] = await Promise.all([
        api.get('/api/admin/courses'),
        api.get('/api/admin/progress')
      ]);
      setCourses(coursesResponse.data);
      setProgress(progressResponse.data);
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
        <div className="px-8 py-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your learning management system</p>
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
                <p className="text-muted-foreground">Loading dashboard data...</p>
              </div>
            ) : (
              <>
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* Total Courses */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Courses</p>
                          <p className="text-3xl font-bold text-foreground mt-2">{courses.length}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Learners */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Learners</p>
                          <p className="text-3xl font-bold text-foreground mt-2">
                            {new Set(progress.map(p => p.userId)).size}
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                          <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Enrollments */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Enrollments</p>
                          <p className="text-3xl font-bold text-foreground mt-2">
                            {progress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length}
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                          <UserPlus className="h-6 w-6 text-accent" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Completions */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Completions</p>
                          <p className="text-3xl font-bold text-foreground mt-2">
                            {progress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length}
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                          <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Active Learners */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Active Learners</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-foreground">
                        {progress.filter(p => p.completionStatus === 'in_progress').length}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Currently taking courses</p>
                    </CardContent>
                  </Card>

                  {/* Completion Rate */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Completion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-foreground">
                        {progress.length > 0 
                          ? Math.round((progress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length / progress.length) * 100)
                          : 0}%
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Average completion rate</p>
                    </CardContent>
                  </Card>

                  {/* Total Time Spent */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Total Learning Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-foreground">
                        {Math.round(progress.reduce((acc, p) => acc + (p.timeSpent || 0), 0) / 3600)}h
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Hours of learning</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section */}
                {chartData.courseData.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Course Enrollment Comparison */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Course Enrollment</CardTitle>
                        <CardDescription>Number of learners enrolled per course</CardDescription>
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Completion Rate by Course</CardTitle>
                      <CardDescription>Percentage of enrolled learners who completed</CardDescription>
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Enrollment Status Distribution</CardTitle>
                      <CardDescription>Breakdown of learner enrollment status</CardDescription>
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Progress Distribution</CardTitle>
                      <CardDescription>Distribution of learners by progress percentage</CardDescription>
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
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Enrollment & Completion Trends</CardTitle>
                      <CardDescription>Monthly enrollment and completion trends over time</CardDescription>
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
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Average Time Spent by Course</CardTitle>
                      <CardDescription>Average learning time (minutes) per course</CardDescription>
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
                  <Card className="mb-8">
                    <CardContent className="p-12 text-center">
                      <p className="text-muted-foreground">No data available for charts. Create courses and enroll learners to see analytics.</p>
                    </CardContent>
                  </Card>
                )}

                {/* Course Statistics Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Course Statistics</CardTitle>
                    <CardDescription>Detailed overview of enrollment and completion by course</CardDescription>
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
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
