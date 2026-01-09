import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trash2, AlertTriangle, FileText, Folder, Key, Image, Play, Sparkles, Info, X } from "lucide-react";
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

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
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
    loadCourses();
  }, []);

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
        <title>Course Management | Creative Learning</title>
        <meta name="description" content="Manage courses in the learning management system." />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        <div className="px-8 py-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Course Management</h1>
              <p className="text-muted-foreground mt-1">Create, view, and manage courses</p>
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
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                {error}
              </div>
            )}

            {showCourseForm && (
              <Card className="border-2 shadow-lg mb-6">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
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
                      {courses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No courses available. Create your first course to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

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
