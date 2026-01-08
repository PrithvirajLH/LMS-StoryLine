import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/layout/Navbar";
import { BookOpen, Users, UserPlus, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "../services/api";
import { getUser } from "../services/auth";

interface Course {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  activityId: string;
  blobPath: string;
  launchFile: string;
  enrollmentCount: number;
  attemptCount: number;
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

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'courses' | 'progress' | 'settings'>('dashboard');
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<LearnerProgress[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [filterCompleted, setFilterCompleted] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    thumbnailUrl: '',
    launchFile: 'index_lms.html',
    activityId: '',
    blobPath: '',
  });
  const user = getUser();

  useEffect(() => {
    if (activeTab === 'courses') {
      loadCourses();
    } else if (activeTab === 'progress') {
      // Load both courses and progress for the filter
      loadCourses();
      loadProgress();
    } else if (activeTab === 'dashboard') {
      // Load both courses and progress for dashboard stats
      loadCourses();
      loadProgress();
    }
  }, [activeTab]);

  // Filter progress when course selection or progress data changes
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

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/courses');
      setCourses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load courses');
      toast.error(err.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/progress');
      setProgress(response.data);
      // Initialize filtered progress with all data
      setFilteredProgress(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load progress');
      toast.error(err.response?.data?.error || 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      // Map blobPath to coursePath for backend
      const courseData = {
        ...courseForm,
        coursePath: courseForm.blobPath
      };
      delete courseData.blobPath; // Remove blobPath, use coursePath
      await api.post('/api/admin/courses', courseData);
      setShowCourseForm(false);
      setCourseForm({
        title: '',
        description: '',
        thumbnailUrl: '',
        launchFile: 'index_lms.html',
        activityId: '',
        blobPath: '',
      });
      toast.success('Course created successfully');
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create course');
      toast.error(err.response?.data?.error || 'Failed to create course');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      await api.delete(`/api/admin/courses/${courseId}`);
      toast.success('Course deleted successfully');
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete course');
      toast.error(err.response?.data?.error || 'Failed to delete course');
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
        <title>Admin Panel | Creative Learning</title>
        <meta name="description" content="Manage courses, view learner progress, and configure settings." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 lg:px-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Admin Panel</h1>

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                {error}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="courses">Courses</TabsTrigger>
                <TabsTrigger value="progress">Learner Progress</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
                
                {loading ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground">Loading dashboard data...</p>
                  </div>
                ) : (
                  <>
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                    {/* Course Statistics Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Course Statistics</CardTitle>
                        <CardDescription>Overview of enrollment and completion by course</CardDescription>
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
                            {courses.map((course) => {
                              const courseProgress = progress.filter(p => p.courseId === course.courseId);
                              const enrolled = courseProgress.filter(p => p.enrollmentStatus === 'enrolled' || p.enrollmentStatus === 'in_progress').length;
                              const completed = courseProgress.filter(p => p.completionStatus === 'completed' || p.completionStatus === 'passed').length;
                              const inProgress = courseProgress.filter(p => p.completionStatus === 'in_progress').length;
                              const completionRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
                              
                              return (
                                <TableRow key={course.courseId}>
                                  <TableCell className="font-medium">{course.title}</TableCell>
                                  <TableCell>{enrolled}</TableCell>
                                  <TableCell>{completed}</TableCell>
                                  <TableCell>{inProgress}</TableCell>
                                  <TableCell>
                                    <span className={completionRate >= 70 ? 'text-green-600 dark:text-green-400' : completionRate >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}>
                                      {completionRate}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
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
              </TabsContent>

              <TabsContent value="courses" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground">Course Management</h2>
                  <Button onClick={() => setShowCourseForm(!showCourseForm)}>
                    {showCourseForm ? 'Cancel' : '+ Create Course'}
                  </Button>
                </div>

                {showCourseForm && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Create New Course</CardTitle>
                      <CardDescription>Add a new course to the LMS</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateCourse} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Title *</Label>
                          <Input
                            id="title"
                            value={courseForm.title}
                            onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={courseForm.description}
                            onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="blobPath">Course Folder Path *</Label>
                          <Input
                            id="blobPath"
                            value={courseForm.blobPath}
                            onChange={(e) => setCourseForm({ ...courseForm, blobPath: e.target.value })}
                            placeholder="sharepoint-navigation-101-custom"
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Folder name in blob storage (e.g., sharepoint-navigation-101-custom)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="activityId">Activity ID (xAPI IRI) *</Label>
                          <div className="flex gap-2">
                            <Input
                              id="activityId"
                              value={courseForm.activityId}
                              onChange={(e) => setCourseForm({ ...courseForm, activityId: e.target.value })}
                              placeholder="http://example.com/activity/course-name"
                              required
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                if (!courseForm.blobPath) {
                                  toast.error('Please enter course folder path first');
                                  return;
                                }
                                try {
                                  setLoading(true);
                                  const response = await api.get(`/api/admin/extract-activity-id?coursePath=${encodeURIComponent(courseForm.blobPath)}`);
                                  setCourseForm({ ...courseForm, activityId: response.data.activityId });
                                  toast.success(`Activity ID extracted: ${response.data.activityId}`);
                                } catch (err: any) {
                                  toast.error(err.response?.data?.error || 'Failed to extract activity ID');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={!courseForm.blobPath || loading}
                            >
                              Auto-fill
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Unique identifier for this course in xAPI format.
                            <br />💡 <strong>Tip:</strong> Enter the course folder path above and click "Auto-fill" to extract from tincan.xml automatically.
                            <br />Examples: <code>urn:articulate:storyline:5Ujw93Dh98n</code> or <code>http://example.com/activity/course-name</code>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="launchFile">Launch File</Label>
                          <Input
                            id="launchFile"
                            value={courseForm.launchFile}
                            onChange={(e) => setCourseForm({ ...courseForm, launchFile: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                          <div className="flex gap-2">
                            <Input
                              id="thumbnailUrl"
                              type="text"
                              value={courseForm.thumbnailUrl}
                              onChange={(e) => setCourseForm({ ...courseForm, thumbnailUrl: e.target.value })}
                              placeholder="/course/course-folder/mobile/thumbnail.jpg"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                if (!courseForm.blobPath) {
                                  toast.error('Please enter course folder path first');
                                  return;
                                }
                                try {
                                  setLoading(true);
                                  const response = await api.get(`/api/admin/find-thumbnail?coursePath=${encodeURIComponent(courseForm.blobPath)}`);
                                  if (response.data.found && response.data.thumbnailUrl) {
                                    setCourseForm({ ...courseForm, thumbnailUrl: response.data.thumbnailUrl });
                                    toast.success(`Thumbnail found: ${response.data.thumbnailUrl}`);
                                  } else {
                                    toast.info(response.data.message || 'No thumbnail image found');
                                  }
                                } catch (err: any) {
                                  toast.error(err.response?.data?.error || 'Failed to find thumbnail');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={!courseForm.blobPath || loading}
                            >
                              Find Thumbnail
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Path to course thumbnail image. Click "Find Thumbnail" to auto-detect from course files, or enter manually (e.g., /course/course-folder/mobile/poster.jpg)
                          </p>
                        </div>
                        <Button type="submit" className="w-full">Create Course</Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {loading ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground">Loading courses...</p>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Activity ID</TableHead>
                            <TableHead>Enrollments</TableHead>
                            <TableHead>Attempts</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {courses.map((course) => (
                            <TableRow key={course.courseId}>
                              <TableCell className="font-medium">{course.title}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{course.activityId}</TableCell>
                              <TableCell>{course.enrollmentCount}</TableCell>
                              <TableCell>{course.attemptCount}</TableCell>
                              <TableCell>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteCourse(course.courseId)}
                                >
                                  Delete
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="progress" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground">Learner Progress</h2>
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
                {loading ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground">Loading progress...</p>
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
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">LRS Configuration</h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Current Configuration</CardTitle>
                    <CardDescription>
                      LRS settings are configured via environment variables on the server.
                      Contact your system administrator to update these settings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Endpoint:</strong> Configured</p>
                      <p className="text-sm"><strong>Authentication:</strong> Configured</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </>
  );
}
