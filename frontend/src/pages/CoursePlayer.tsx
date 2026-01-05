import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import api from "../services/api";
import { getToken } from "../services/auth";

const CoursePlayer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
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
        if (response.data.course?.progressPercent !== undefined) {
          setProgress(response.data.course.progressPercent);
        } else if (response.data.course?.score) {
          setProgress(response.data.course.score);
        } else {
          setProgress(0);
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
  }, [courseId]);

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
            <Button onClick={() => navigate("/courses")} className="w-full">
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
          <Button onClick={() => navigate("/courses")}>Back to Courses</Button>
        </div>
      </div>
    );
  }

  // Add token as query parameter for iframe
  const token = getToken();
  const baseUrl = launchUrl.startsWith('http')
    ? launchUrl
    : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${launchUrl}`;
  const fullLaunchUrl = token ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : baseUrl;

  return (
    <>
      <Helmet>
        <title>{course.title} | Creative Learning</title>
        <meta name="description" content={`Learning: ${course.title}`} />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header Bar */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary border-b border-primary-foreground/10 px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/courses")}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Exit Course
            </Button>
            <div className="hidden sm:block h-6 w-px bg-primary-foreground/20" />
            <h1 className="hidden sm:block text-primary-foreground font-medium truncate max-w-md">
              {course.title}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/courses")}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
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
        <div className="md:hidden bg-primary border-t border-primary-foreground/10 px-4 py-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-primary-foreground/70">Progress</span>
            <span className="font-medium text-accent">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>
    </>
  );
};

export default CoursePlayer;
