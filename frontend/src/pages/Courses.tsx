import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Search, Code } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
}

type FilterType = 'all' | 'my';

const Courses = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>('all');
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
      const response = await api.get('/api/courses');
      setCourses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by "My Courses" if selected
    if (filter === 'my') {
      const isEnrolled = course.isEnrolled || course.enrollmentStatus === 'enrolled';
      const hasProgress = course.completionStatus !== undefined && course.completionStatus !== null;
      if (!isEnrolled && !hasProgress) {
        return false;
      }
    }
    
    return matchesSearch;
  });

  const handleCourseClick = (courseId: string) => {
    navigate(`/player/${courseId}`);
  };

  const handleEnroll = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/api/courses/${courseId}/launch`);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to enroll in course');
    }
  };

  return (
    <>
      <Helmet>
        <title>Browse Courses | Creative Learning</title>
        <meta 
          name="description" 
          content="Browse and discover courses in our marketplace." 
        />
      </Helmet>

      <div className="flex flex-col h-full">
        {/* Top Header */}
        <header className="p-6 border-b border-border/50 bg-card/50 backdrop-blur-sm flex items-center min-h-[81px]">
          <div className="flex items-center justify-between w-full gap-4">
            {/* Search Input */}
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for a course"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 rounded-full border-border/50 bg-background"
              />
            </div>
            
            {/* Filter Toggle */}
            <div className="flex items-center gap-2 bg-muted/50 rounded-full p-1 border border-border/50">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Courses
              </button>
              <button
                onClick={() => setFilter('my')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === 'my'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My Courses
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
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
                {filteredCourses.map((course) => {
                  const isCompleted = course.completedAt || 
                                      course.completionStatus === 'completed' || 
                                      course.completionStatus === 'passed' ||
                                      (course.progressPercent !== undefined && course.progressPercent >= 100);
                  const isEnrolled = course.isEnrolled || course.enrollmentStatus === 'enrolled';
                  const isInProgress = isEnrolled && !isCompleted && (course.progressPercent || 0) > 0;
                  const progress = course.progressPercent !== undefined ? course.progressPercent : (isCompleted ? 100 : 0);

                  return (
                    <div
                      key={course.courseId}
                      className="group bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-lg hover:border-border transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col"
                    >
                      {/* Course Image */}
                      <div 
                        onClick={() => handleCourseClick(course.courseId)}
                        className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-secondary to-secondary/80 rounded-t-xl cursor-pointer"
                      >
                        {course.thumbnailUrl ? (
                          <img
                            src={course.thumbnailUrl}
                            alt={course.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-primary/5">
                            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Code className="h-8 w-8 text-primary/30" />
                            </div>
                          </div>
                        )}
                        {/* Status Badge */}
                        {isEnrolled && (
                          <div className="absolute top-3 right-3">
                            <Badge className={
                              isCompleted 
                                ? "bg-accent text-accent-foreground border-0 shadow-md" 
                                : "bg-success text-success-foreground border-0 shadow-md"
                            }>
                              {isCompleted ? "Completed" : "Enrolled"}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Course Info */}
                      <div className="p-4 flex-1 flex flex-col">
                        <div 
                          onClick={() => handleCourseClick(course.courseId)}
                          className="cursor-pointer"
                        >
                          <h3 className="font-bold text-base text-foreground mb-1 line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
                            {course.title}
                          </h3>
                          {course.category && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {course.category}
                            </p>
                          )}
                        </div>

                        {/* Progress Bar for Enrolled Courses */}
                        {isEnrolled && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground font-medium">Progress</span>
                              <span className={`font-semibold ${
                                isCompleted ? 'text-accent' : 'text-primary'
                              }`}>
                                {progress}%
                              </span>
                            </div>
                            <Progress 
                              value={progress} 
                              className={`h-2 ${
                                isCompleted ? 'bg-accent/20' : 'bg-primary/20'
                              }`}
                            />
                          </div>
                        )}

                        {/* Action Button */}
                        <div className="mt-auto">
                          {!isEnrolled ? (
                            <Button
                              onClick={(e) => handleEnroll(course.courseId, e)}
                              className="w-full font-semibold"
                              size="sm"
                            >
                              Enroll
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleCourseClick(course.courseId)}
                              variant="default"
                              className="w-full font-semibold"
                              size="sm"
                            >
                              {isCompleted ? "Review Course" : "Continue Learning"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg mb-4">
                  {filter === 'my' 
                    ? searchQuery 
                      ? 'No enrolled courses found matching your search'
                      : 'You haven\'t enrolled in any courses yet'
                    : searchQuery
                      ? 'No courses found matching your search'
                      : 'No courses available'
                  }
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

export default Courses;
