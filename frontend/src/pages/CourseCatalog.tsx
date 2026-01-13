import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import api from '../services/api';
import { getUser } from '../services/auth';
import CourseCard from '../components/CourseCard';

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

export default function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
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

  const handleEnroll = async (courseId: string) => {
    try {
      await api.post(`/api/courses/${courseId}/launch`);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to enroll in course');
    }
  };

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-hero">
      <main className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search courses by title or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 text-base glass-sm"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive shadow-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg">Loading courses...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredCourses.length === 0 ? (
              <div className="col-span-full text-center py-16 glass-card p-8">
                <p className="text-muted-foreground text-lg">No courses found</p>
              </div>
            ) : (
              filteredCourses.map((course) => (
                <CourseCard
                  key={course.courseId}
                  course={course}
                  onEnroll={handleEnroll}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
