import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Users, CheckCircle2, XCircle, AlertCircle, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

const primaryColor = '#881337';

export default function LearnerManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<LearnerProgress[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [pageSize, setPageSize] = useState('200');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [filterCompleted, setFilterCompleted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    setPageTokens([null]);
    setPageIndex(0);
    setNextToken(null);
    loadProgressPage(null, 0, true);
  }, [selectedCourseId, pageSize]);

  useEffect(() => {
    let filtered = progress;
    
    if (selectedCourseId !== 'all') {
      filtered = filtered.filter(p => p.courseId === selectedCourseId);
    }
    
    if (filterCompleted) {
      filtered = filtered.filter(p => 
        p.completionStatus === 'completed' || p.completionStatus === 'passed'
      );
    }
    
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

  const loadCourses = async () => {
    try {
      const response = await api.get('/api/admin/courses');
      setCourses(response.data);
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load learner data';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const loadProgressPage = async (token: string | null, nextIndex: number, resetTokens = false) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.set('paginated', '1');
      params.set('limit', pageSize);
      if (selectedCourseId !== 'all') {
        params.set('courseId', selectedCourseId);
      }
      if (token) {
        params.set('continuationToken', token);
      }

      const response = await api.get(`/api/admin/progress?${params.toString()}`);
      setProgress(response.data?.data || []);
      setNextToken(response.data?.continuationToken || null);
      setPageIndex(nextIndex);
      setPageTokens(prev => {
        const base = resetTokens ? [null] : [...prev];
        base[nextIndex] = token;
        return base;
      });
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load learner data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = async () => {
    if (!nextToken) return;
    await loadProgressPage(nextToken, pageIndex + 1);
  };

  const handlePrevPage = async () => {
    if (pageIndex === 0) return;
    const prevToken = pageTokens[pageIndex - 1] || null;
    await loadProgressPage(prevToken, pageIndex - 1);
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
      return `${minutes}m${secs > 0 ? ` ${secs}s` : ''}`;
    }
    return `${secs}s`;
  };

  const getStatusBadge = (item: LearnerProgress) => {
    const isCompleted = item.completionStatus === 'completed' || item.completionStatus === 'passed';
    const isFailed = item.completionStatus === 'failed';
    const isInProgress = item.enrollmentStatus === 'in_progress' || item.completionStatus === 'in_progress';
    
    if (isCompleted) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          Completed
        </Badge>
      );
    }
    if (isFailed) {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">
          <XCircle className="h-3.5 w-3.5 mr-1" />
          Failed
        </Badge>
      );
    }
    if (isInProgress) {
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">
          <AlertCircle className="h-3.5 w-3.5 mr-1" />
          In Progress
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-0">
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
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="macro-padding py-8">
            <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-2">
              Learner Management
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              Track learner progress and enrollments across all courses
            </p>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pt-6 pb-8">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                {error}
              </div>
            )}

            {/* Filters */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.1 }}
              className="flex items-center gap-4 flex-wrap mb-6"
            >
              <div className="relative flex-1 min-w-[250px] max-w-[400px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search learners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-[220px] h-11">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Courses" />
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
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="w-[140px] h-11">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="500">500 rows</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="completed-only" 
                  checked={filterCompleted}
                  onCheckedChange={(checked) => setFilterCompleted(checked === true)}
                />
                <label htmlFor="completed-only" className="cursor-pointer">
                  Completed only
                </label>
              </div>
              {(selectedCourseId !== 'all' || filterCompleted || searchQuery) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCourseId('all');
                    setFilterCompleted(false);
                  }}
                  className="text-muted-foreground"
                >
                  Clear filters
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-muted-foreground">
                  {filteredProgress.length} result{filteredProgress.length !== 1 ? 's' : ''} • Page {pageIndex + 1}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrevPage}
                  disabled={loading || pageIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNextPage}
                  disabled={loading || !nextToken}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg">Loading learners...</p>
                </div>
              </div>
            ) : filteredProgress.length === 0 ? (
              <Card className="bg-muted/40 border-border shadow-sm">
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground text-lg">
                    {searchQuery || selectedCourseId !== 'all' || filterCompleted
                      ? 'No learners found matching your filters.' 
                      : 'No learner progress data available.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5" style={{ color: primaryColor }} />
                      Learner Progress
                    </CardTitle>
                    <CardDescription>
                      Detailed view of all learner enrollments and progress
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                            <TableHead className="font-semibold text-foreground">Learner</TableHead>
                            <TableHead className="font-semibold text-foreground">Course</TableHead>
                            <TableHead className="font-semibold text-foreground">Status</TableHead>
                            <TableHead className="font-semibold text-foreground">Progress</TableHead>
                            <TableHead className="font-semibold text-foreground">Score</TableHead>
                            <TableHead className="font-semibold text-foreground">Time</TableHead>
                            <TableHead className="font-semibold text-foreground">Enrolled</TableHead>
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
                                      <AvatarFallback style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                                        {getInitials(item)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium">
                                        {item.firstName || item.lastName 
                                          ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
                                          : item.email?.split('@')[0] || 'Unknown'}
                                      </div>
                                      <div className="text-sm text-muted-foreground">{item.email}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[180px] truncate" title={item.courseTitle}>
                                    {item.courseTitle}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(item)}
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">
                                    {progressPercent}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {item.score !== undefined && item.score !== null ? (
                                    <span className={`font-medium ${
                                      item.score >= 80 ? 'text-emerald-600' :
                                      item.score >= 60 ? 'text-amber-600' :
                                      'text-red-600'
                                    }`}>
                                      {Math.round(item.score)}%
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-muted-foreground">
                                    {formatTimeSpent(item.timeSpent)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-muted-foreground">
                                    {new Date(item.enrolledAt).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric'
                                    })}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {item.completedAt ? (
                                    <span className="text-emerald-600">
                                      {new Date(item.completedAt).toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric'
                                      })}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
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
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
