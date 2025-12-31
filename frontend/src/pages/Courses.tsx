import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Search, Filter, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Users, Star } from "lucide-react";
import api from "../services/api";

interface Course {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  isEnrolled: boolean;
  enrollmentStatus?: string;
  completionStatus?: string;
  score?: number;
}

const Courses = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const handleEnroll = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/api/courses/${courseId}/launch`);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to enroll in course');
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const categories = ["All", "Development", "Design", "Data Science", "Cloud", "Security"];
  const categoriesWithCounts = categories.map(cat => ({
    name: cat,
    count: cat === "All" ? courses.length : courses.filter(c => c.category === cat).length
  }));

  const handleCourseClick = (courseId: string) => {
    navigate(`/player/${courseId}`);
  };

  return (
    <>
      <Helmet>
        <title>My Courses | Creative Learning</title>
        <meta 
          name="description" 
          content="Access your enrolled courses and continue learning with Articulate Storyline content." 
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="pt-24 pb-16">
          {/* Header */}
          <section className="bg-primary/5 py-12">
            <div className="container mx-auto px-4 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
              >
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                  My Courses
                </h1>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Click on any course to launch the Storyline content
                </p>
              </motion.div>

              {/* Search */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="max-w-xl mx-auto"
              >
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 rounded-xl bg-card border-border/50 shadow-sm"
                  />
                </div>
              </motion.div>
            </div>
          </section>

          {/* Filters & Courses */}
          <section className="py-8">
            <div className="container mx-auto px-4 lg:px-8">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Filters */}
                <motion.aside
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="lg:w-56 flex-shrink-0"
                >
                  <div className="sticky top-24 space-y-6">
                    {/* Categories */}
                    <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
                      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Categories
                      </h3>
                      <div className="space-y-1">
                        {categoriesWithCounts.map((category) => (
                          <button
                            key={category.name}
                            onClick={() => setSelectedCategory(category.name)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                              selectedCategory === category.name
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            <span>{category.name}</span>
                            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                              {category.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelectedCategory("All");
                        setSearchQuery("");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </motion.aside>

                {/* Course Grid */}
                <div className="flex-1">
                  {error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6">
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{filteredCourses.length}</span> courses available
                    </p>
                  </div>

                  {loading ? (
                    <div className="text-center py-16">
                      <p className="text-muted-foreground">Loading courses...</p>
                    </div>
                  ) : filteredCourses.length > 0 ? (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {filteredCourses.map((course) => {
                        return (
                          <motion.div
                            key={course.courseId}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="group cursor-pointer"
                            onClick={() => handleCourseClick(course.courseId)}
                          >
                            <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                              {/* Thumbnail */}
                              <div className="relative aspect-video overflow-hidden bg-secondary">
                                {course.thumbnailUrl ? (
                                  <img
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                    <Play className="h-12 w-12 text-primary/30" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                  <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-glow">
                                    <Play className="h-6 w-6 text-accent-foreground fill-current" />
                                  </div>
                                </div>
                                {course.isEnrolled && (
                                  <Badge className="absolute top-3 right-3 bg-success text-success-foreground border-0">
                                    Enrolled
                                  </Badge>
                                )}
                              </div>

                              {/* Content */}
                              <div className="p-4">
                                <h3 className="font-bold text-foreground mt-2 mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                                  {course.title}
                                </h3>

                                <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                                  {course.description || "No description available"}
                                </p>

                                {/* Progress */}
                                {course.isEnrolled && course.completionStatus && (
                                  <div className="mb-3">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-muted-foreground">Progress</span>
                                      <span className="font-semibold text-primary">
                                        {course.progressPercent !== undefined ? `${course.progressPercent}%` :
                                         course.completionStatus === 'completed' ? '100%' : 
                                         course.score ? `${course.score}%` : '0%'}
                                      </span>
                                    </div>
                                    <Progress 
                                      value={course.progressPercent !== undefined ? course.progressPercent :
                                             course.score || (course.completionStatus === 'completed' ? 100 : 0)} 
                                      className="h-2" 
                                    />
                                  </div>
                                )}

                                {/* Actions */}
                                {!course.isEnrolled && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={(e) => handleEnroll(course.courseId, e)}
                                  >
                                    Enroll Now
                                  </Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <p className="text-muted-foreground text-lg mb-4">
                        No courses found matching your criteria
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCategory("All");
                          setSearchQuery("");
                        }}
                      >
                        Reset Filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Courses;




