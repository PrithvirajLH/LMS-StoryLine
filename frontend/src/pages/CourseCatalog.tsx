import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import CourseCard from '../components/CourseCard';
import Header from '../components/Header';

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
      // Enroll by launching the course (auto-enrolls)
      await api.post(`/api/courses/${courseId}/launch`);
      // Reload courses to update enrollment status
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
    <div style={styles.container}>
      <Header />

      <main style={styles.main}>
        <div style={styles.searchBar}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search courses by title or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.loading}>Loading courses...</div>
        ) : (
          <div style={styles.grid}>
            {filteredCourses.length === 0 ? (
              <div style={styles.empty}>No courses found</div>
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

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  },
  searchBar: {
    marginBottom: '2rem',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '1rem',
    fontSize: '1.25rem',
    zIndex: 1,
  },
  searchInput: {
    width: '100%',
    padding: '1rem 1rem 1rem 3rem',
    fontSize: '1rem',
    border: '2px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'white',
    color: 'var(--gray-800)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all var(--transition-base)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.5rem',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--gray-600)',
    fontSize: '1.1rem',
  },
  error: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '1rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1rem',
    border: '1px solid #fecaca',
    boxShadow: 'var(--shadow-sm)',
  },
  empty: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--gray-500)',
    gridColumn: '1 / -1',
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
  },
};


