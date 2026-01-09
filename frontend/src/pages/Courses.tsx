import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Search, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import api from "../services/api";
import { getUser } from "@/services/auth";

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

type FilterType = "all" | "my";

const Courses = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
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

  const handleEnroll = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

    return { ...course, isEnrolled, isCompleted, progress };
  });

  // Filter courses
  const filteredCourses = processedCourses.filter((course) => {
    // My Courses filter
    if (filter === "my" && !course.isEnrolled && !course.isCompleted) {
      return false;
    }

    // Search filter
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
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
        {/* Top Header */}
        <header className="px-8 py-6 border-b border-border/50 bg-card/50 backdrop-blur-sm h-[113px]">
          <div className="flex items-center justify-between w-full gap-6">
            {/* Left: Page Title */}
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-semibold text-foreground tracking-tight">Courses</h1>
              <p className="text-sm text-muted-foreground">Browse and discover courses to enhance your learning journey</p>
            </div>

            {/* Right: Search, Notifications, Profile */}
            <div className="flex items-center gap-4">
              {/* Search Input */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-full border-border/50 bg-background text-sm font-normal"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="px-8 py-4 border-b border-border/50 bg-card/30">
          <div className="flex items-center gap-3">
            {/* My Courses Toggle */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-full p-1 border border-border/50 shadow-sm">
              <button
                onClick={() => setFilter("all")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 tracking-tight ${
                  filter === "all"
                    ? "bg-gradient-navy text-white shadow-md scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                All Courses
              </button>
              <button
                onClick={() => setFilter("my")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 tracking-tight ${
                  filter === "my"
                    ? "bg-gradient-teal text-white shadow-md scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                My Courses
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            {/* Course Grid */}
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p>Loading courses...</p>
                </div>
              </div>
            ) : filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.courseId}
                    course={course}
                    onEnroll={handleEnroll}
                    onClick={handleCourseClick}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg mb-4">
                  {filter === "my"
                    ? searchQuery
                      ? "No enrolled courses found matching your search"
                      : "You haven't enrolled in any courses yet"
                    : searchQuery
                    ? "No courses found matching your search"
                    : "No courses available"}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border/50 transition-colors"
                  >
                    Clear Search
                  </button>
                )}
              </div>
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
}

const CourseCard = ({
  course,
  onEnroll,
  onClick,
}: CourseCardProps) => {
  return (
    <div
      className={`bg-card rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden group cursor-pointer flex flex-col ${
        course.isCompleted
          ? "border-green-500/30"
          : course.isEnrolled
          ? "border-blue-500/30"
          : "border-border/50"
      }`}
      onClick={() => onClick(course.courseId)}
    >
      {/* Course Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-secondary to-secondary/80">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-primary/5">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary/30" />
            </div>
          </div>
        )}
      </div>

      {/* Course Info */}
      <div className="flex-1 flex flex-col p-4">
        {/* Title and Button Inline */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 tracking-tight flex-1">
            {course.title}
          </h3>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              if (course.isEnrolled) {
                onClick(course.courseId);
              } else {
                onEnroll(course.courseId, e);
              }
            }}
            className={`px-4 h-8 text-xs rounded-lg font-medium tracking-tight flex-shrink-0 ${
              !course.isEnrolled
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : course.isCompleted
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {course.isEnrolled
              ? course.isCompleted
                ? "Review"
                : "Continue"
              : "Enroll"}
          </Button>
        </div>

        {/* Instructor */}
        {course.instructorName && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Avatar className="h-4 w-4">
              <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                {course.instructorName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground font-normal">
              {course.instructorName}
            </span>
          </div>
        )}

        {/* Lessons and Level */}
        <div className="flex items-center gap-2 mb-2">
          {course.lessonsCount && (
            <p className="text-xs text-muted-foreground font-normal">
              {course.lessonsCount} lessons
            </p>
          )}
          {course.level && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5"
            >
              {course.level}
            </Badge>
          )}
        </div>

        {/* Progress Bar */}
        {course.isEnrolled && (
          <div>
            <Progress
              value={course.progress}
              className={`h-1 bg-muted ${course.isCompleted ? "bg-green-500/20" : ""}`}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;
