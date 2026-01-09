import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/layout/Navbar";
import { BookOpen, Users, UserPlus, Trophy, Search, Trash2, Edit, Eye, Calendar, Clock, TrendingUp, Filter, FileText, Folder, Key, Image, Play, Sparkles, Info, X, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [learnerSearchQuery, setLearnerSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
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

  const handleDeleteCourse = (courseId: string) => {
    setCourseToDelete(courseId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;

    try {
      await api.delete(`/api/admin/courses/${courseToDelete}`);
      toast.success('Course deleted successfully');
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete course');
      toast.error(err.response?.data?.error || 'Failed to delete course');
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Course Management</h2>
                    <p className="text-sm text-muted-foreground mt-1">Create and manage courses in your LMS</p>
                  </div>
                  <Button 
                    onClick={() => setShowCourseForm(!showCourseForm)} 
                    className="w-full sm:w-auto"
                    variant={showCourseForm ? "outline" : "default"}
                  >
                    {showCourseForm ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Create New Course
                      </>
                    )}
                  </Button>
                </div>

                {showCourseForm && (
                  <Card className="border-2 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Create New Course</CardTitle>
                          <CardDescription className="text-sm mt-1">Add a new course to your learning management system</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <form onSubmit={handleCreateCourse} className="space-y-6">
                        {/* Basic Information Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <FileText className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold">Basic Information</h3>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                              Course Title <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="title"
                              value={courseForm.title}
                              onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                              placeholder="Enter course title"
                              className="h-11"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                            <Textarea
                              id="description"
                              value={courseForm.description}
                              onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                              placeholder="Provide a brief description of the course..."
                              rows={4}
                              className="resize-none"
                            />
                          </div>
                        </div>

                        {/* Storage & Path Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <Folder className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold">Storage Configuration</h3>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="blobPath" className="text-sm font-medium flex items-center gap-2">
                                Course Folder Path <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative">
                                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="blobPath"
                                  value={courseForm.blobPath}
                                  onChange={(e) => setCourseForm({ ...courseForm, blobPath: e.target.value })}
                                  placeholder="sharepoint-navigation-101-custom"
                                  className="pl-10 h-11"
                                  required
                                />
                              </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-border/50 mt-3">
                              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-muted-foreground">
                                Folder name in Azure Blob Storage where course files are stored (e.g., sharepoint-navigation-101-custom)
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* xAPI Configuration Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <Key className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold">xAPI Configuration</h3>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="activityId" className="text-sm font-medium flex items-center gap-2">
                                Activity ID (xAPI IRI) <span className="text-destructive">*</span>
                              </Label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    id="activityId"
                                    value={courseForm.activityId}
                                    onChange={(e) => setCourseForm({ ...courseForm, activityId: e.target.value })}
                                    placeholder="urn:articulate:storyline:5Ujw93Dh98n"
                                    className="pl-10 h-11"
                                    required
                                  />
                                </div>
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
                                  className="h-11 px-4"
                                >
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Auto-fill
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-border/50 mt-3">
                              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>Unique identifier for this course in xAPI format.</p>
                                <p><strong>Tip:</strong> Enter the course folder path above and click "Auto-fill" to extract from tincan.xml automatically.</p>
                                <p className="font-mono text-[10px] mt-2">Examples: urn:articulate:storyline:5Ujw93Dh98n or http://example.com/activity/course-name</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Launch & Media Section */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <Play className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold">Launch & Media</h3>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="launchFile" className="text-sm font-medium flex items-center gap-2">
                              Launch File
                            </Label>
                            <div className="relative">
                              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="launchFile"
                                value={courseForm.launchFile}
                                onChange={(e) => setCourseForm({ ...courseForm, launchFile: e.target.value })}
                                placeholder="index_lms.html"
                                className="pl-10 h-11"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground ml-1">Default: index_lms.html</p>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="thumbnailUrl" className="text-sm font-medium flex items-center gap-2">
                                Thumbnail Image URL
                              </Label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    id="thumbnailUrl"
                                    type="text"
                                    value={courseForm.thumbnailUrl}
                                    onChange={(e) => setCourseForm({ ...courseForm, thumbnailUrl: e.target.value })}
                                    placeholder="/course/course-folder/mobile/thumbnail.jpg"
                                    className="pl-10 h-11"
                                  />
                                </div>
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
                                  className="h-11 px-4"
                                >
                                  <Image className="h-4 w-4 mr-2" />
                                  Find
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-border/50 mt-3">
                              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-muted-foreground">
                                Path to course thumbnail image. Click "Find" to auto-detect from course files, or enter manually.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4 border-t">
                          <Button 
                            type="submit" 
                            className="w-full h-12 text-base font-semibold"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Creating Course...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-5 w-5 mr-2" />
                                Create Course
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {!showCourseForm && (
                  <>
                    {courses.length === 0 ? (
                      <Card>
                        <CardContent className="p-12 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                              <BookOpen className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Create Your First Course?</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Click the button above to get started with adding a new course to your LMS.
                              </p>
                              <Button onClick={() => setShowCourseForm(true)}>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Create New Course
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-foreground">
                            Existing Courses ({courses.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {courses.map((course) => (
                            <Card key={course.courseId} className="border-2 hover:shadow-lg transition-shadow">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
                                    {course.description && (
                                      <CardDescription className="text-sm mt-1 line-clamp-2">
                                        {course.description}
                                      </CardDescription>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Folder className="h-4 w-4" />
                                    <span className="truncate max-w-[200px]">{course.blobPath || 'N/A'}</span>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteCourse(course.courseId)}
                                    className="ml-2"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="progress" className="space-y-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Learner Management</h2>
                    <p className="text-sm text-muted-foreground mt-1">Track and monitor learner progress across all courses</p>
                  </div>
                  
                  {/* Filters and Search */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by learner name or email..."
                        value={learnerSearchQuery}
                        onChange={(e) => setLearnerSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                      <SelectTrigger className="w-full sm:w-[250px]">
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
                    <div className="flex items-center space-x-2 px-3 py-2 border rounded-md">
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
                  </div>
                  
                  {(selectedCourseId !== 'all' || filterCompleted || learnerSearchQuery) && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>
                        {filteredProgress.filter(p => 
                          learnerSearchQuery === '' ||
                          (p.firstName || '').toLowerCase().includes(learnerSearchQuery.toLowerCase()) ||
                          (p.lastName || '').toLowerCase().includes(learnerSearchQuery.toLowerCase()) ||
                          (p.email || '').toLowerCase().includes(learnerSearchQuery.toLowerCase())
                        ).length} {filteredProgress.length === 1 ? 'learner' : 'learners'} found
                      </span>
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p>Loading progress...</p>
                    </div>
                  </div>
                ) : (() => {
                  const displayProgress = filteredProgress.filter(p => 
                    learnerSearchQuery === '' ||
                    (p.firstName || '').toLowerCase().includes(learnerSearchQuery.toLowerCase()) ||
                    (p.lastName || '').toLowerCase().includes(learnerSearchQuery.toLowerCase()) ||
                    (p.email || '').toLowerCase().includes(learnerSearchQuery.toLowerCase())
                  );
                  
                  return displayProgress.length === 0 ? (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground">
                          {selectedCourseId !== 'all' || filterCompleted || learnerSearchQuery
                            ? 'No learners found matching your filters.' 
                            : 'No learner progress data available.'}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-2 border-black shadow-lg">
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <div className="relative w-full overflow-auto">
                            <table className="w-full border-collapse">
                              <thead className="bg-black border-b-2 border-black">
                                <tr className="border-b-2 border-black">
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white border-r-2 border-black py-4">Learner</th>
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white border-r-2 border-black py-4">Course</th>
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white border-r-2 border-black py-4">Status</th>
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white border-r-2 border-black py-4">Progress</th>
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white border-r-2 border-black py-4">Time Spent</th>
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white border-r-2 border-black py-4">Attempts</th>
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white border-r-2 border-black py-4">Enrolled</th>
                                  <th className="h-12 px-4 text-left align-middle font-bold text-white py-4">Completed</th>
                                </tr>
                              </thead>
                              <tbody>
                              {displayProgress.map((item, idx) => {
                                const progressPercent = item.completedAt || item.completionStatus === 'completed' || item.completionStatus === 'passed' 
                                  ? 100 
                                  : item.progressPercent !== undefined && item.progressPercent !== null 
                                    ? item.progressPercent 
                                    : item.score !== undefined && item.score !== null 
                                      ? item.score 
                                      : 0;
                                const isCompleted = progressPercent === 100;
                                
                                return (
                                  <tr 
                                    key={`${item.userId}-${item.courseId}-${idx}`} 
                                    className="border-b-2 border-black hover:bg-muted/30 transition-colors"
                                  >
                                    <td className="p-4 align-middle border-r-2 border-black py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/20">
                                          <Users className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                          <div className="font-semibold text-foreground">
                                            {item.firstName || item.lastName 
                                              ? `${item.firstName || ''} ${item.lastName || ''}`.trim()
                                              : item.email?.split('@')[0] || item.userId || 'Unknown User'}
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-0.5">{item.email || item.userId}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle border-r-2 border-black py-4">
                                      <div className="font-medium text-foreground">{item.courseTitle}</div>
                                    </td>
                                    <td className="p-4 align-middle border-r-2 border-black py-4">
                                      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold shadow-sm ${
                                        isCompleted 
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-300'
                                          : item.enrollmentStatus === 'in_progress'
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-300'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300'
                                      }`}>
                                        {isCompleted ? 'Completed' : item.enrollmentStatus || 'Enrolled'}
                                      </span>
                                    </td>
                                    <td className="p-4 align-middle border-r-2 border-black py-4">
                                      <div className="flex items-center gap-3 min-w-[120px]">
                                        <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden border border-black/20">
                                          <div 
                                            className={`h-full transition-all duration-300 ${
                                              isCompleted 
                                                ? 'bg-green-500' 
                                                : progressPercent >= 50 
                                                  ? 'bg-blue-500' 
                                                  : 'bg-yellow-500'
                                            }`}
                                            style={{ width: `${progressPercent}%` }}
                                          />
                                        </div>
                                        <span className="text-sm font-bold w-12 text-right text-foreground">{progressPercent}%</span>
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle border-r-2 border-black py-4">
                                      <div className="flex items-center gap-2 text-sm font-medium">
                                        <Clock className="h-4 w-4 text-primary" />
                                        <span className="text-foreground">
                                          {item.timeSpent 
                                            ? `${Math.floor(item.timeSpent / 3600)}h ${Math.floor((item.timeSpent % 3600) / 60)}m`
                                            : '0m'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle border-r-2 border-black py-4">
                                      <div className="flex items-center gap-2 font-medium">
                                        <TrendingUp className="h-4 w-4 text-primary" />
                                        <span className="text-foreground">{item.attempts || 0}</span>
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle border-r-2 border-black py-4">
                                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <Calendar className="h-4 w-4 text-primary" />
                                        {new Date(item.enrolledAt).toLocaleDateString()}
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle py-4">
                                      {item.completedAt ? (
                                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                          <Calendar className="h-4 w-4 text-primary" />
                                          {new Date(item.completedAt).toLocaleDateString()}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground font-medium">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
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

        {/* Delete Course Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl">Delete Course</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-base pt-2">
                Are you sure you want to delete this course? This action cannot be undone and will permanently remove:
              </AlertDialogDescription>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border/50 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive"></div>
                  <span className="text-foreground">Course record and metadata</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive"></div>
                  <span className="text-foreground">All learner progress data</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive"></div>
                  <span className="text-foreground">Course enrollment information</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                <strong>Note:</strong> Course files in Azure Blob Storage will remain, but the course will no longer be accessible in the LMS.
              </p>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel onClick={() => {
                setDeleteDialogOpen(false);
                setCourseToDelete(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteCourse}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Course
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
