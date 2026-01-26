import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Maximize2, Minimize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import api from "../services/api";
import { getToken, getUser } from "../services/auth";
import { useCurrentCourse } from "@/contexts/CurrentCourseContext";

const CoursePlayer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { setCurrentCourse } = useCurrentCourse();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [course, setCourse] = useState<any>(null);
  const [launchUrl, setLaunchUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!courseId) return;

    async function launchCourse() {
      try {
        setLoading(true);
        const response = await api.post(`/api/courses/${courseId}/launch`);
        setCourse(response.data.course);
        setLaunchUrl(response.data.launchUrl);
        // Get progressPercent from database (preferred) or fallback to score
        const initialProgress = response.data.course?.progressPercent !== undefined
          ? response.data.course.progressPercent
          : response.data.course?.score || 0;
        setProgress(initialProgress);
        
        // Update current course context for NowBar
        if (response.data.course) {
          setCurrentCourse({
            courseId: response.data.course.courseId || courseId || '',
            title: response.data.course.title || '',
            progress: initialProgress,
          });
        }
      } catch (err: any) {
        console.error('❌ Course Launch Error:', err);
        console.error('Error Details:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          message: err.message,
          courseId
        });
        const errorMessage = err.response?.data?.error || err.message || 'Failed to launch course';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    launchCourse();
  }, [courseId, setCurrentCourse]);

  // Poll for progress updates every 5 seconds while course is active
  useEffect(() => {
    if (!courseId || !course || loading) return;

    const user = getUser();
    const userId = user?.email || user?.userId;
    if (!userId) return;

    const updateProgress = async () => {
      try {
        const response = await api.get(`/api/users/${encodeURIComponent(userId)}/courses`);
        const coursesData = Array.isArray(response.data) ? response.data : [];
        const currentCourseData = coursesData.find((c: any) => c.courseId === courseId);
        
        if (currentCourseData) {
          const newProgress = currentCourseData.progressPercent !== undefined
            ? currentCourseData.progressPercent
            : currentCourseData.score || 0;
          
          // Only update if progress changed (avoid unnecessary re-renders)
          if (Math.abs(newProgress - progress) > 0.1) {
            setProgress(newProgress);
            
            // Update current course context for NowBar
            setCurrentCourse({
              courseId: currentCourseData.courseId || courseId || '',
              title: currentCourseData.title || course.title || '',
              progress: newProgress,
            });
          }
        }
      } catch (err) {
        // Silently fail - don't interrupt course experience
        console.debug('Progress update failed:', err);
      }
    };

    // Update immediately, then every 5 seconds
    updateProgress();
    const interval = setInterval(updateProgress, 5000);

    return () => clearInterval(interval);
  }, [courseId, course, loading, progress, setCurrentCourse]);

  // Cleanup on unmount - must be before any early returns
  useEffect(() => {
    return () => {
      setCurrentCourse(null);
    };
  }, [setCurrentCourse]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Error Loading Course</h1>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive font-medium mb-2">{error}</p>
            {courseId && (
              <p className="text-sm text-muted-foreground mt-2">
                Course ID: {courseId}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Button onClick={() => navigate("/learner/courses")} className="w-full">
              Back to Courses
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setError('');
                setLoading(true);
                // Retry launch
                const launchCourse = async () => {
                  try {
                    const response = await api.post(`/api/courses/${courseId}/launch`);
                    setCourse(response.data.course);
                    setLaunchUrl(response.data.launchUrl);
                    // Get progressPercent from database (preferred) or fallback to score
                    if (response.data.course?.progressPercent !== undefined) {
                      setProgress(response.data.course.progressPercent);
                    } else if (response.data.course?.score) {
                      setProgress(response.data.course.score);
                    } else {
                      setProgress(0);
                    }
                    
                    // Update current course context for NowBar
                    if (response.data.course) {
                      setCurrentCourse({
                        courseId: response.data.course.courseId || courseId || '',
                        title: response.data.course.title || '',
                        progress: response.data.course.progressPercent || response.data.course.score || 0,
                      });
                    }
                    setError('');
                  } catch (err: any) {
                    setError(err.response?.data?.error || err.message || 'Failed to launch course');
                  } finally {
                    setLoading(false);
                  }
                };
                launchCourse();
              }}
              className="w-full"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Course not found</h1>
          <Button onClick={() => navigate("/learner/courses")}>Back to Courses</Button>
        </div>
      </div>
    );
  }

  // Add token as query parameter for iframe
  const token = getToken();
  // Use window.location.origin for network access, fallback to env or localhost
  const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
  const baseUrl = launchUrl.startsWith('http')
    ? launchUrl
    : `${apiBase}${launchUrl}`;
  const fullLaunchUrl = token ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : baseUrl;

  return (
    <>
      <Helmet>
        <title>{course.title} | Creative Learning</title>
        <meta name="description" content={`Learning: ${course.title}`} />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col lg:flex-row relative">
        {/* Left 20% - Sticky Navigation & Stats (Desktop) */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ 
            opacity: 1, 
            x: 0,
            width: isSidebarCollapsed ? 0 : '20%'
          }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="hidden lg:flex flex-col border-r border-border bg-card/30 sticky top-0 h-screen overflow-hidden"
          style={{ width: isSidebarCollapsed ? 0 : '20%' }}
        >
          <motion.div 
            className="p-4 sm:p-6 macro-padding h-full overflow-y-auto"
            animate={{ opacity: isSidebarCollapsed ? 0 : 1 }}
            transition={{ duration: 0.2 }}
            style={{ display: isSidebarCollapsed ? 'none' : 'block' }}
          >
            {loading || !course ? (
              /* Loading State */
              <div className="flex flex-col h-full">
                {/* Exit Button Skeleton */}
                <div className="mb-4 h-8 w-20 bg-muted/50 rounded animate-pulse" />

                {/* Course Title Skeleton */}
                <div className="mb-6 space-y-2">
                  <div className="h-6 bg-muted/50 rounded animate-pulse" />
                  <div className="h-6 bg-muted/50 rounded animate-pulse w-3/4" />
                </div>

                {/* Progress Stats Skeleton */}
                <div className="space-y-4">
                  <div>
                    <div className="h-3 w-20 bg-muted/50 rounded animate-pulse mb-1.5" />
                    <div className="h-12 bg-muted/50 rounded animate-pulse mb-1" />
                    <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                  </div>

                  {/* Status Skeleton */}
                  <div className="pt-4 border-t border-border">
                    <div className="h-3 w-16 bg-muted/50 rounded animate-pulse mb-2" />
                    <div className="h-6 w-24 bg-muted/50 rounded animate-pulse" />
                  </div>
                </div>

                {/* Loading Indicator */}
                <div className="mt-auto pt-6 flex flex-col items-center justify-center space-y-3">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground text-center">Loading course...</p>
                </div>
              </div>
            ) : (
              /* Course Content */
              <>
                {/* Exit Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/learner/courses")}
                  className="mb-4 text-foreground/70 hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3 mr-1.5" />
                  <span className="text-xs">Exit</span>
                </Button>

                {/* Course Title - Editorial Serif */}
                <h1 className="text-xl lg:text-2xl font-serif font-bold mb-6 leading-tight tracking-tight line-clamp-3">
                  {course.title}
                </h1>

                {/* Progress Stats - Big Serif Numbers */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">Progress</p>
                    <p className="text-4xl font-serif font-bold text-foreground">{Math.round(progress)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">percent complete</p>
                  </div>

                  {/* Additional Stats */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Status</p>
                    <p className="text-lg font-serif font-semibold text-foreground">
                      {progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started'}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="mt-auto pt-6 space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="w-full glass-sm text-xs"
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="h-3 w-3 mr-1.5" />
                        Exit Fullscreen
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3 w-3 mr-1.5" />
                        Enter Fullscreen
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.aside>
        
        {/* Collapse/Expand Toggle Button - Always visible */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:flex absolute top-4 z-20 bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card transition-all duration-300"
          style={{ 
            left: isSidebarCollapsed ? '8px' : 'calc(20% - 32px)'
          }}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Right 80% - Scrollable Learning Content */}
        <motion.div 
          className="flex-1 flex flex-col"
          animate={{ width: isSidebarCollapsed ? '100%' : '80%' }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{ width: isSidebarCollapsed ? '100%' : '80%' }}
        >
          {/* Mobile Header */}
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden bg-card/50 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/learner/courses")}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-serif font-bold truncate">{course.title}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </motion.header>

          {/* Course Content - Storyline iFrame */}
          <div className="flex-1 relative bg-transparent">
            <iframe
              src={fullLaunchUrl}
              className="absolute inset-0 w-full h-full border-0 bg-transparent"
              title={course.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              style={{ backgroundColor: 'transparent' }}
              onError={(e) => {
                console.error('❌ Iframe Load Error:', e);
                console.error('❌ Failed URL:', fullLaunchUrl);
              }}
            />
            {!fullLaunchUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <div className="text-center max-w-md p-6">
                  <p className="text-muted-foreground font-medium mb-4">No launch URL available</p>
                  <div className="bg-card rounded-lg p-4 border border-border text-left">
                    <p className="text-sm text-muted-foreground mb-1"><strong>Course:</strong> {course?.title}</p>
                    <p className="text-sm text-muted-foreground mb-1"><strong>Launch File:</strong> {course?.launchFile || 'Not set'}</p>
                    <p className="text-sm text-muted-foreground mb-1"><strong>Blob Path:</strong> {course?.blobPath || 'Not set'}</p>
                    <p className="text-sm text-muted-foreground"><strong>Course ID:</strong> {courseId}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Please check the browser console for more details.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Progress Bar */}
          <div className="lg:hidden bg-card/50 backdrop-blur-sm border-t border-border px-4 py-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-serif font-bold text-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default CoursePlayer;
