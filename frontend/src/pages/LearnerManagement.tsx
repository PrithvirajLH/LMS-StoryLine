import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Users, Clock, CheckCircle2, XCircle, AlertCircle, Search, Filter, Award } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import api from "../services/api";
import { getUser } from "../services/auth";

interface Course {
  courseId: string;
  title: string;
}

interface LearnerProgress {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  courseId: string;
  courseTitle: string;
  enrolledAt: string;
  enrollmentStatus: string;
  completionStatus?: string;
  score?: number;
  progressPercent?: number;
  timeSpent?: number;
  attempts?: number;
  startedAt?: string;
  completedAt?: string;
  lastAccessedAt?: string;
}

export default function LearnerManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<LearnerProgress[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [filterCompleted, setFilterCompleted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = progress;
    
    // Filter by course
    if (selectedCourseId !== 'all') {
      filtered = filtered.filter(p => p.courseId === selectedCourseId);
    }
    
    // Filter by completion status
    if (filterCompleted) {
      filtered = filtered.filter(p => 
        p.completionStatus === 'completed' || p.completionStatus === 'passed'
      );
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.email?.toLowerCase().includes(query) ||
        p.firstName?.toLowerCase().includes(query) ||
        p.lastName?.toLowerCase().includes(query) ||
        p.courseTitle?.toLowerCase().includes(query) ||
        p.userId?.toLowerCase().includes(query)
      );
    }
    
    setFilteredProgress(filtered);
  }, [selectedCourseId, filterCompleted, progress, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [coursesResponse, progressResponse] = await Promise.all([
        api.get('/api/admin/courses'),
        api.get('/api/admin/progress')
      ]);
      setCourses(coursesResponse.data);
      setProgress(progressResponse.data);
      setFilteredProgress(progressResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load learner data');
      toast.error(err.response?.data?.error || 'Failed to load learner data');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (item: LearnerProgress) => {
    if (item.firstName && item.lastName) {
      return `${item.firstName[0]}${item.lastName[0]}`.toUpperCase();
    }
    if (item.firstName) {
      return item.firstName[0].toUpperCase();
    }
    if (item.email) {
      return item.email[0].toUpperCase();
    }
    return 'U';
  };

  const getProgressPercent = (item: LearnerProgress): number => {
    if (item.completedAt || item.completionStatus === 'completed' || item.completionStatus === 'passed') {
      return 100;
    }
    if (item.progressPercent !== undefined && item.progressPercent !== null) {
      return Math.min(100, Math.max(0, item.progressPercent));
    }
    if (item.score !== undefined && item.score !== null) {
      return Math.min(100, Math.max(0, item.score));
    }
    return 0;
  };

  const formatTimeSpent = (seconds?: number): string => {
    if (!seconds || seconds === 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs > 0 ? `${secs}s` : ''}`;
    }
    return `${secs}s`;
  };

  const getStatusBadge = (item: LearnerProgress) => {
    const isCompleted = item.completionStatus === 'completed' || item.completionStatus === 'passed';
    const isFailed = item.completionStatus === 'failed';
    const isInProgress = item.enrollmentStatus === 'in_progress' || item.completionStatus === 'in_progress';
    
    if (isCompleted) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    }
    if (isFailed) {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
    if (isInProgress) {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200">
        Enrolled
      </Badge>
    );
  };

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
        <title>Learner Management | Creative Learning</title>
        <meta name="description" content="View and manage learner progress and enrollments." />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        <div className="px-8 py-6 border-b border-border/50 glass shadow-glass">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-8 w-8" />
                Learner Management
              </h1>
              <p className="text-muted-foreground mt-1">Track learner progress and enrollments across all courses</p>
            </div>
          </div>
          
          {/* Filters and Search */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-[250px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.courseId} value={course.courseId}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="completed-only" 
                checked={filterCompleted}
                onCheckedChange={(checked) => setFilterCompleted(checked === true)}
              />
              <label
                htmlFor="completed-only"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Completed only
              </label>
            </div>
            {(selectedCourseId !== 'all' || filterCompleted || searchQuery) && (
              <div className="text-sm text-muted-foreground font-medium">
                {filteredProgress.length} {filteredProgress.length === 1 ? 'learner' : 'learners'} found
              </div>
            )}
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
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground">Loading learner data...</p>
              </div>
            ) : filteredProgress.length === 0 ? (
              <Card className="border-2 border-black shadow-lg">
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground text-lg">
                    {searchQuery || selectedCourseId !== 'all' || filterCompleted
                      ? 'No learners found matching your filters.' 
                      : 'No learner progress data available.'}
                  </p>
                  {(searchQuery || selectedCourseId !== 'all' || filterCompleted) && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCourseId('all');
                        setFilterCompleted(false);
                      }}
                      className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-black shadow-lg">
                <CardHeader className="bg-black text-white rounded-t-lg">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Learner Progress ({filteredProgress.length})
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Detailed view of all learner enrollments and progress
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead className="font-semibold text-foreground">Learner</TableHead>
                          <TableHead className="font-semibold text-foreground">Course</TableHead>
                          <TableHead className="font-semibold text-foreground">Enrolled</TableHead>
                          <TableHead className="font-semibold text-foreground">Status</TableHead>
                          <TableHead className="font-semibold text-foreground">Progress</TableHead>
                          <TableHead className="font-semibold text-foreground">
                            <Award className="h-4 w-4 inline mr-1" />
                            Score
                          </TableHead>
                          <TableHead className="font-semibold text-foreground">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Time Spent
                          </TableHead>
                          <TableHead className="font-semibold text-foreground">Attempts</TableHead>
                          <TableHead className="font-semibold text-foreground">Started</TableHead>
                          <TableHead className="font-semibold text-foreground">Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProgress.map((item, idx) => {
                          const progressPercent = getProgressPercent(item);
                          return (
                            <TableRow 
                              key={`${item.userId}-${item.courseId}-${idx}`}
                              className="hover:bg-muted/50 transition-colors border-b border-border"
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                      {getInitials(item)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-semibold text-foreground">
                                      {item.firstName || item.lastName 
                                        ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
                                        : item.email?.split('@')[0] || item.userId || 'Unknown User'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{item.email || item.userId}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-foreground max-w-[200px] truncate" title={item.courseTitle}>
                                  {item.courseTitle}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-foreground">
                                  {new Date(item.enrolledAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(item)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <Progress value={progressPercent} className="h-2 flex-1" />
                                  <span className="text-sm font-semibold text-foreground min-w-[40px]">
                                    {progressPercent}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.score !== undefined && item.score !== null ? (
                                  <div className="flex items-center gap-1">
                                    <Award className="h-4 w-4 text-yellow-600" />
                                    <span className={`text-sm font-semibold ${
                                      item.score >= 80 ? 'text-green-600' :
                                      item.score >= 60 ? 'text-yellow-600' :
                                      'text-red-600'
                                    }`}>
                                      {Math.round(item.score)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm text-foreground">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  {formatTimeSpent(item.timeSpent)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-medium">
                                  {item.attempts || 0}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.startedAt ? (
                                  <div className="text-sm text-foreground">
                                    {new Date(item.startedAt).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.completedAt ? (
                                  <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {new Date(item.completedAt).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
