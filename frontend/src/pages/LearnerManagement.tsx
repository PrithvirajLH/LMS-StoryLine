import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
    
    setFilteredProgress(filtered);
  }, [selectedCourseId, filterCompleted, progress]);

  const loadData = async () => {
    try {
      setLoading(true);
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
        <div className="px-8 py-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Learner Management</h1>
              <p className="text-muted-foreground mt-1">Track learner progress and enrollments</p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-[250px]">
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
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Completed only
                </label>
              </div>
              {(selectedCourseId !== 'all' || filterCompleted) && (
                <div className="text-sm text-muted-foreground">
                  {filteredProgress.length} {filteredProgress.length === 1 ? 'learner' : 'learners'} found
                </div>
              )}
            </div>
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
                <p className="text-muted-foreground">Loading learner data...</p>
              </div>
            ) : filteredProgress.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">
                    {selectedCourseId === 'all' 
                      ? 'No learner progress data available.' 
                      : 'No learners found for this course.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Learner</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Enrolled</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Time Spent</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Completed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProgress.map((item, idx) => (
                        <TableRow key={`${item.userId}-${item.courseId}-${idx}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {item.firstName || item.lastName 
                                  ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
                                  : item.email?.split('@')[0] || item.userId || 'Unknown User'}
                              </div>
                              <div className="text-xs text-muted-foreground">{item.email || item.userId}</div>
                            </div>
                          </TableCell>
                          <TableCell>{item.courseTitle}</TableCell>
                          <TableCell>{new Date(item.enrolledAt).toLocaleDateString()}</TableCell>
                          <TableCell>{item.enrollmentStatus}</TableCell>
                          <TableCell>
                            {item.completedAt || item.completionStatus === 'completed' || item.completionStatus === 'passed' ? '100%' :
                             item.progressPercent !== undefined && item.progressPercent !== null ? `${item.progressPercent}%` :
                             item.score !== undefined && item.score !== null ? `${item.score}%` : '0%'}
                          </TableCell>
                          <TableCell>
                            {item.timeSpent ? `${Math.floor(item.timeSpent / 60)}m ${item.timeSpent % 60}s` : '0s'}
                          </TableCell>
                          <TableCell>{item.attempts || 0}</TableCell>
                          <TableCell>
                            {item.startedAt ? new Date(item.startedAt).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
