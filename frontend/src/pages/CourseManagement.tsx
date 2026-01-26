import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
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
import { Trash2, AlertTriangle, Image, Sparkles, Edit, BookOpen } from "lucide-react";
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

const primaryColor = '#881337';

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
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
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load courses';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const courseData = {
        ...courseForm,
        coursePath: courseForm.blobPath
      };
      delete (courseData as { blobPath?: string }).blobPath;
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
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create course';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourseId(course.courseId);
    setCourseForm({
      title: course.title,
      description: course.description || '',
      thumbnailUrl: course.thumbnailUrl || '',
      launchFile: course.launchFile || 'index_lms.html',
      activityId: course.activityId || '',
      blobPath: course.blobPath || '',
    });
    setShowCourseForm(true);
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId) return;
    
    try {
      setError('');
      const courseData = {
        ...courseForm,
        coursePath: courseForm.blobPath
      };
      await api.put(`/api/admin/courses/${editingCourseId}`, courseData);
      setShowCourseForm(false);
      setEditingCourseId(null);
      setCourseForm({
        title: '',
        description: '',
        thumbnailUrl: '',
        launchFile: 'index_lms.html',
        activityId: '',
        blobPath: '',
      });
      toast.success('Course updated successfully');
      loadCourses();
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update course';
      setError(errorMessage);
      toast.error(errorMessage);
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
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete course';
      setError(errorMessage);
      toast.error(errorMessage);
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
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="macro-padding py-8">
            <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-2">
              Course Management
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              Create, view, and manage courses
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

            {/* Action Button */}
            {!showCourseForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <Button 
                  onClick={() => setShowCourseForm(true)} 
                  className="h-11"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  New Course
                </Button>
              </motion.div>
            )}

            {showCourseForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm mb-6">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold">
                      {editingCourseId ? 'Edit Course' : 'New Course'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={editingCourseId ? handleUpdateCourse : handleCreateCourse} className="space-y-5">
                      {/* Row 1: Title & Folder Path */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Title *</Label>
                          <Input
                            id="title"
                            value={courseForm.title}
                            onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                            placeholder="Course title"
                            className="h-11"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="blobPath">Folder Path *</Label>
                          <Input
                            id="blobPath"
                            value={courseForm.blobPath}
                            onChange={(e) => setCourseForm({ ...courseForm, blobPath: e.target.value })}
                            placeholder="course-folder-name"
                            className="h-11"
                            required
                          />
                        </div>
                      </div>

                      {/* Row 2: Activity ID with Auto-fill */}
                      <div className="space-y-2">
                        <Label htmlFor="activityId">Activity ID *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="activityId"
                            value={courseForm.activityId}
                            onChange={(e) => setCourseForm({ ...courseForm, activityId: e.target.value })}
                            placeholder="urn:articulate:storyline:xxx"
                            className="h-11"
                            required
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              if (!courseForm.blobPath) {
                                toast.error('Enter folder path first');
                                return;
                              }
                              try {
                                setLoading(true);
                                const response = await api.get(`/api/admin/extract-activity-id?coursePath=${encodeURIComponent(courseForm.blobPath)}`);
                                setCourseForm({ ...courseForm, activityId: response.data.activityId });
                                toast.success('Activity ID extracted');
                              } catch {
                                toast.error('Failed to extract');
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

                      {/* Row 3: Description */}
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={courseForm.description}
                          onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                          placeholder="Brief description..."
                          rows={3}
                          className="resize-none"
                        />
                      </div>

                      {/* Advanced options */}
                      <details className="group">
                        <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          Advanced options
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                          <div className="space-y-2">
                            <Label htmlFor="launchFile">Launch File</Label>
                            <Input
                              id="launchFile"
                              value={courseForm.launchFile}
                              onChange={(e) => setCourseForm({ ...courseForm, launchFile: e.target.value })}
                              placeholder="index_lms.html"
                              className="h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                            <div className="flex gap-2">
                              <Input
                                id="thumbnailUrl"
                                value={courseForm.thumbnailUrl}
                                onChange={(e) => setCourseForm({ ...courseForm, thumbnailUrl: e.target.value })}
                                placeholder="/course/folder/thumbnail.jpg"
                                className="h-11"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                  if (!courseForm.blobPath) {
                                    toast.error('Enter folder path first');
                                    return;
                                  }
                                  try {
                                    setLoading(true);
                                    const response = await api.get(`/api/admin/find-thumbnail?coursePath=${encodeURIComponent(courseForm.blobPath)}`);
                                    if (response.data.found) {
                                      setCourseForm({ ...courseForm, thumbnailUrl: response.data.thumbnailUrl });
                                      toast.success('Thumbnail found');
                                    } else {
                                      toast.info('No thumbnail found');
                                    }
                                  } catch {
                                    toast.error('Failed to find');
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
                        </div>
                      </details>

                      {/* Submit */}
                      <div className="flex gap-3 pt-2">
                        <Button 
                          type="submit" 
                          className="flex-1 h-11"
                          disabled={loading}
                          style={{ backgroundColor: primaryColor }}
                        >
                          {loading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            editingCourseId ? 'Update Course' : 'Create Course'
                          )}
                        </Button>
                        <Button 
                          type="button"
                          variant="outline"
                          className="h-11"
                          onClick={() => {
                            setShowCourseForm(false);
                            setEditingCourseId(null);
                            setCourseForm({
                              title: '',
                              description: '',
                              thumbnailUrl: '',
                              launchFile: 'index_lms.html',
                              activityId: '',
                              blobPath: '',
                            });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {loading && !showCourseForm ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg">Loading courses...</p>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                      <BookOpen className="h-5 w-5" style={{ color: primaryColor }} />
                      All Courses
                    </CardTitle>
                    <CardDescription>
                      Manage your courses and view enrollment data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                            <TableHead className="font-semibold text-foreground">Title</TableHead>
                            <TableHead className="font-semibold text-foreground">Activity ID</TableHead>
                            <TableHead className="font-semibold text-foreground text-center">Enrollments</TableHead>
                            <TableHead className="font-semibold text-foreground text-center">Attempts</TableHead>
                            <TableHead className="font-semibold text-foreground">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {courses.map((course) => (
                            <TableRow key={course.courseId} className="hover:bg-muted/50 transition-colors border-b border-border">
                              <TableCell className="font-medium">{course.title}</TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate">{course.activityId}</TableCell>
                              <TableCell className="text-center">{course.enrollmentCount}</TableCell>
                              <TableCell className="text-center">{course.attemptCount}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => handleEditCourse(course)}
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => handleDeleteCourse(course.courseId)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {courses.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                                No courses available. Create your first course to get started.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl">Delete Course</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-base">
                Are you sure you want to delete this course? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
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
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
