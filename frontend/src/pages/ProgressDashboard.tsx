import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import ProgressIndicator from '../components/ProgressIndicator';
import Header from '../components/Header';

interface CourseProgress {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  enrollmentStatus: string;
  completionStatus: string;
  score?: number;
  timeSpent?: string;
  enrolledAt: string;
  startedAt?: string;
  completedAt?: string;
}

export default function ProgressDashboard() {
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/users/${user?.userId}/courses`);
      setCourses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <Header title="My Learning Progress" />

      <main style={styles.main}>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.loading}>Loading progress...</div>
        ) : courses.length === 0 ? (
          <div style={styles.empty}>
            <p>You haven't enrolled in any courses yet.</p>
            <button onClick={() => navigate('/courses')} style={styles.button}>
              Browse Courses
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {courses.map((course) => (
              <div key={course.courseId} style={styles.card}>
                {course.thumbnailUrl && (
                  <img src={course.thumbnailUrl} alt={course.title} style={styles.thumbnail} />
                )}
                <div style={styles.content}>
                  <h3 style={styles.title}>{course.title}</h3>
                  {course.description && (
                    <p style={styles.description}>{course.description}</p>
                  )}

                  <div style={styles.progressSection}>
                    <ProgressIndicator
                      status={course.completionStatus}
                      score={course.score}
                    />
                    {course.timeSpent && (
                      <p style={styles.timeSpent}>Time Spent: {course.timeSpent}</p>
                    )}
                  </div>

                  <div style={styles.meta}>
                    <p style={styles.metaText}>
                      Enrolled: {new Date(course.enrolledAt).toLocaleDateString()}
                    </p>
                    {course.completedAt && (
                      <p style={styles.metaText}>
                        Completed: {new Date(course.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => navigate(`/player/${course.courseId}`)}
                    style={styles.button}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                  >
                    {course.completionStatus === 'completed' || course.completionStatus === 'passed'
                      ? 'Review Course'
                      : 'Continue Learning'}
                  </button>
                </div>
              </div>
            ))}
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all var(--transition-base)',
    border: '1px solid var(--gray-200)',
  },
  thumbnail: {
    width: '100%',
    height: '200px',
    objectFit: 'cover',
    backgroundColor: 'var(--gray-100)',
  },
  content: {
    padding: '1.5rem',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    marginBottom: '0.75rem',
    color: 'var(--gray-800)',
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  description: {
    color: 'var(--gray-600)',
    marginBottom: '1rem',
    fontSize: '0.95rem',
    lineHeight: '1.6',
  },
  progressSection: {
    marginBottom: '1rem',
  },
  timeSpent: {
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
    marginTop: '0.5rem',
    fontWeight: '500',
  },
  meta: {
    marginBottom: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--gray-200)',
  },
  metaText: {
    fontSize: '0.875rem',
    color: 'var(--gray-500)',
    margin: '0.25rem 0',
  },
  button: {
    padding: '0.875rem 1.5rem',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    marginTop: 'auto',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
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
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--gray-200)',
  },
};


