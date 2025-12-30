import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  startedAt?: string;
  completedAt?: string;
  lastAccessedAt?: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'courses' | 'progress' | 'settings'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
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
      loadProgress();
    }
  }, [activeTab]);

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
        <title>Admin Panel | Learn Swift Hub</title>
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="courses">Courses</TabsTrigger>
                <TabsTrigger value="progress">Learner Progress</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

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
                          <Label htmlFor="activityId">Activity ID (xAPI IRI) *</Label>
                          <Input
                            id="activityId"
                            value={courseForm.activityId}
                            onChange={(e) => setCourseForm({ ...courseForm, activityId: e.target.value })}
                            placeholder="http://example.com/activity/course-name"
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Unique identifier for this course in xAPI format.
                            <br />💡 <strong>Tip:</strong> Enter the course folder path below and click "Auto-fill" to extract from tincan.xml automatically.
                            <br />Examples: <code>urn:articulate:storyline:5Ujw93Dh98n</code> or <code>http://example.com/activity/course-name</code>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="blobPath">Course Folder Path *</Label>
                          <div className="flex gap-2">
                            <Input
                              id="blobPath"
                              value={courseForm.blobPath}
                              onChange={(e) => setCourseForm({ ...courseForm, blobPath: e.target.value })}
                              placeholder="sharepoint-navigation-101-custom"
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
                            Folder name in blob storage (e.g., sharepoint-navigation-101-custom). Click "Auto-fill" to extract Activity ID from tincan.xml
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
                          <Input
                            id="thumbnailUrl"
                            type="url"
                            value={courseForm.thumbnailUrl}
                            onChange={(e) => setCourseForm({ ...courseForm, thumbnailUrl: e.target.value })}
                          />
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
                <h2 className="text-2xl font-bold text-foreground">Learner Progress</h2>
                {loading ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground">Loading progress...</p>
                  </div>
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
                            <TableHead>Started</TableHead>
                            <TableHead>Completed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {progress.map((item, idx) => (
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

        <Footer />
      </div>
    </>
  );
}
