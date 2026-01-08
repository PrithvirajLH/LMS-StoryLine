import { Link } from 'react-router-dom';
import ProgressIndicator from './ProgressIndicator';

interface CourseCardProps {
  course: {
    courseId: string;
    title: string;
    description?: string;
    thumbnailUrl?: string;
    isEnrolled?: boolean;
    enrollmentStatus?: string;
    completionStatus?: string;
    score?: number;
  };
  onEnroll?: (courseId: string) => void;
}

export default function CourseCard({ course, onEnroll }: CourseCardProps) {
  return (
    <div
      style={styles.card}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
    >
      {course.thumbnailUrl && (
        <img src={course.thumbnailUrl} alt={course.title} style={styles.thumbnail} />
      )}
      <div style={styles.content}>
        <h3 style={styles.title}>{course.title}</h3>
        {course.description && <p style={styles.description}>{course.description}</p>}
        
        {course.isEnrolled && (
          <div style={styles.progress}>
            <ProgressIndicator
              status={course.completionStatus || 'not_started'}
              score={course.score}
            />
          </div>
        )}

        <div style={course.isEnrolled ? styles.actions : styles.actionsNoProgress}>
          {course.isEnrolled ? (
            <Link
              to={`/player/${course.courseId}`}
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
            </Link>
          ) : (
            <button
              onClick={() => onEnroll && onEnroll(course.courseId)}
              style={styles.enrollButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              Enroll Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all var(--transition-base)',
    border: '1px solid var(--gray-200)',
    cursor: 'pointer',
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
    lineHeight: '1.3',
  },
  description: {
    color: 'var(--gray-600)',
    marginBottom: '1rem',
    flex: 1,
    fontSize: '0.95rem',
    lineHeight: '1.6',
  },
  progress: {
    marginBottom: '1rem',
  },
  actions: {
    marginTop: 'auto',
  },
  actionsNoProgress: {
    marginTop: '0.5rem',
  },
  button: {
    display: 'inline-block',
    padding: '0.875rem 1.5rem',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
  },
  enrollButton: {
    padding: '0.875rem 1.5rem',
    background: 'linear-gradient(135deg, var(--success) 0%, var(--success-light) 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    width: '100%',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
  },
};


