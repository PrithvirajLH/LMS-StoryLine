import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import api from "../services/api";
import { getUser } from "@/services/auth";
import CourseGallery from "@/components/CourseGallery";

interface Course {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  isEnrolled: boolean;
  enrollmentStatus?: string;
  completionStatus?: string;
  score?: number;
  progressPercent?: number;
  category?: string;
  completedAt?: string;
  instructorName?: string;
  lessonsCount?: number;
  level?: string;
}

const Courses = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/courses");
      setCourses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = (courseId: string) => {
    navigate(`/player/${courseId}`);
  };

  const handleEnroll = async (courseId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.post(`/api/courses/${courseId}/launch`);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to enroll in course");
    }
  };

  // Process courses with state
  const processedCourses = courses.map((course) => {
    const isEnrolled =
      course.isEnrolled || course.enrollmentStatus === "enrolled";
    const isCompleted =
      !!course.completedAt ||
      course.completionStatus === "completed" ||
      course.completionStatus === "passed" ||
      (course.progressPercent !== undefined && course.progressPercent >= 100);
    const progress =
      course.progressPercent !== undefined
        ? course.progressPercent
        : isCompleted
        ? 100
        : 0;
    const isInProgress = isEnrolled && !isCompleted && progress > 0 && progress < 100;

    return { ...course, isEnrolled, isCompleted, isInProgress, progress };
  });

  // Filter courses by search
  const filteredCourses = processedCourses.filter((course) => {
    // Search filter
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Sort courses: Not Enrolled -> Enrolled -> In Progress -> Completed
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    // Priority: 1 = Not Enrolled, 2 = Enrolled, 3 = In Progress, 4 = Completed
    const getPriority = (course: typeof a) => {
      if (course.isCompleted) return 4;
      if (course.isInProgress) return 3;
      if (course.isEnrolled) return 2;
      return 1;
    };

    const priorityA = getPriority(a);
    const priorityB = getPriority(b);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // If same priority, sort alphabetically by title
    return a.title.localeCompare(b.title);
  });

  return (
    <>
      <Helmet>
        <title>Courses | Creative Learning</title>
        <meta
          name="description"
          content="Browse and discover courses in our marketplace."
        />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="px-8 py-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex flex-col gap-6 flex-1">
                <div>
                  <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-4">
                    Courses
                  </h1>
                  <p className="text-muted-foreground text-lg font-serif">
                    Browse and discover courses to enhance your learning journey
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 border-border bg-background focus:border-foreground transition-colors rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20"
              >
                {error}
              </motion.div>
            )}

            {/* Course Gallery */}
            {loading ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center gap-3 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-medium">Loading courses...</p>
                </div>
              </div>
            ) : sortedCourses.length > 0 ? (
              <CourseGallery
                courses={sortedCourses}
                onEnroll={(courseId) => handleEnroll(courseId)}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <p className="text-muted-foreground text-lg mb-4">
                  {searchQuery
                    ? "No courses found matching your search"
                    : "No courses available"}
                </p>
                {searchQuery && (
                  <Button
                    onClick={() => setSearchQuery("")}
                    variant="outline"
                    className="mt-4"
                  >
                    Clear Search
                  </Button>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Course Card Component
interface CourseCardProps {
  course: Course & { isEnrolled: boolean; isCompleted: boolean; progress: number };
  onEnroll: (courseId: string, e: React.MouseEvent) => void;
  onClick: (courseId: string) => void;
  index: number;
}

const CourseCard = ({
  course,
  onEnroll,
  onClick,
  index,
}: CourseCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer flex flex-col"
      onClick={() => onClick(course.courseId)}
    >
      {/* Course Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-muted">
            <div className="h-16 w-16 rounded-lg bg-foreground/5 flex items-center justify-center">
              <div className="h-8 w-8 rounded bg-foreground/10" />
            </div>
          </div>
        )}
        {course.isEnrolled && (
          <div className="absolute top-3 right-3">
            <Badge
              variant="secondary"
              className={`text-xs font-medium ${
                course.isCompleted
                  ? "bg-foreground/10 text-foreground border-border"
                  : "bg-background/80 text-foreground border-border backdrop-blur-sm"
              }`}
            >
              {course.isCompleted ? "Completed" : "Enrolled"}
            </Badge>
          </div>
        )}
      </div>

      {/* Course Info */}
      <div className="flex-1 flex flex-col p-5">
        {/* Title and Button */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-base text-foreground group-hover:text-foreground/80 transition-colors line-clamp-2 tracking-tight flex-1 leading-snug">
            {course.title}
          </h3>
        </div>

        {/* Instructor */}
        {course.instructorName && (
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-foreground/10 text-foreground text-[10px] font-medium">
                {course.instructorName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {course.instructorName}
            </span>
          </div>
        )}

        {/* Lessons and Level */}
        <div className="flex items-center gap-2 mb-4">
          {course.lessonsCount && (
            <span className="text-xs text-muted-foreground">
              {course.lessonsCount} lessons
            </span>
          )}
          {course.level && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 font-normal border-border"
            >
              {course.level}
            </Badge>
          )}
        </div>

        {/* Progress Bar */}
        {course.isEnrolled && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-medium text-foreground">{Math.round(course.progress)}%</span>
            </div>
            <Progress
              value={course.progress}
              className="h-1.5 bg-muted"
            />
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            if (course.isEnrolled) {
              onClick(course.courseId);
            } else {
              onEnroll(course.courseId, e);
            }
          }}
          className={`w-full h-10 text-sm font-medium transition-all duration-200 ${
            !course.isEnrolled
              ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm hover:shadow-md"
              : course.isCompleted
              ? "bg-foreground/10 text-foreground hover:bg-foreground/20 border border-border"
              : "bg-foreground text-background hover:bg-foreground/90 shadow-sm hover:shadow-md"
          }`}
        >
          {course.isEnrolled
            ? course.isCompleted
              ? "Review Course"
              : "Continue Learning"
            : "Enroll Now"}
        </Button>
      </div>
    </motion.div>
  );
};

export default Courses;
