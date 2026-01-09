import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
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

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
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
            <Button onClick={() => setShowCourseForm(!showCourseForm)}>
              {showCourseForm ? 'Cancel' : '+ Create Course'}
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
              <Card className="mb-6">
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
      </div>
    </>
  );
}
