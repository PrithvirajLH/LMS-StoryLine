import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getToken } from '../services/auth';

export default function CoursePlayer() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [launchUrl, setLaunchUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId) return;

    async function launchCourse() {
      try {
        setLoading(true);
        const response = await api.post(`/api/courses/${courseId}/launch`);
        setCourse(response.data.course);
        setLaunchUrl(response.data.launchUrl);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to launch course');
      } finally {
        setLoading(false);
      }
    }

    launchCourse();
  }, [courseId]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading course...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button onClick={() => navigate('/courses')} style={styles.button}>
          Back to Courses
        </button>
      </div>
    );
  }

  // Add token as query parameter for iframe (since iframes don't send headers)
  const token = getToken();
  const baseUrl = launchUrl.startsWith('http')
    ? launchUrl
    : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${launchUrl}`;
  const fullLaunchUrl = token ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : baseUrl;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          onClick={() => navigate('/courses')}
          style={styles.exitButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--danger-light)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--danger)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ← Exit Course
        </button>
        <span style={styles.title}>{course?.title || 'Course'}</span>
      </div>
      <iframe
        src={fullLaunchUrl}
        style={styles.iframe}
        title={course?.title || 'Course Player'}
        allow="fullscreen"
      />
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '1rem 1.5rem',
    background: 'linear-gradient(135deg, var(--gray-800) 0%, var(--gray-900) 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: 'var(--shadow-md)',
  },
  exitButton: {
    padding: '0.625rem 1.25rem',
    backgroundColor: 'var(--danger)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
  },
  title: {
    flex: 1,
    fontSize: '1.1rem',
  },
  iframe: {
    flex: 1,
    border: 'none',
    width: '100%',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    color: '#666',
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '1rem',
    borderRadius: '4px',
    margin: '2rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    margin: '1rem 2rem',
  },
};


