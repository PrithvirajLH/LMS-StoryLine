import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getUser } from '../services/auth';
import Header from '../components/Header';

interface Course {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  activityId: string;
  blobPath: string;
  launchFile: string;
  enrollmentCount: number;
  attemptCount: number;
}

interface LearnerProgress {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  courseId: string;
  courseTitle: string;
  enrolledAt: string;
  enrollmentStatus: string;
  startedAt?: string;
  completedAt?: string;
  lastAccessedAt?: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'courses' | 'progress' | 'settings'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    thumbnailUrl: '',
    launchFile: 'index.html',
    activityId: '',
    blobPath: '',
  });
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    if (activeTab === 'courses') {
      loadCourses();
    } else if (activeTab === 'progress') {
      loadProgress();
    }
  }, [activeTab]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/courses');
      setCourses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/progress');
      setProgress(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await api.post('/api/admin/courses', courseForm);
      setShowCourseForm(false);
      setCourseForm({
        title: '',
        description: '',
        thumbnailUrl: '',
        launchFile: 'index.html',
        activityId: '',
        blobPath: '',
      });
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create course');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      await api.delete(`/api/admin/courses/${courseId}`);
      loadCourses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete course');
    }
  };

  return (
    <div style={styles.container}>
      <Header title="Admin Panel" />

      <main style={styles.main}>
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('courses')}
            style={{
              ...styles.tab,
              ...(activeTab === 'courses' ? styles.tabActive : {}),
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'courses') {
                e.currentTarget.style.backgroundColor = 'var(--gray-100)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'courses') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Courses
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            style={{
              ...styles.tab,
              ...(activeTab === 'progress' ? styles.tabActive : {}),
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'progress') {
                e.currentTarget.style.backgroundColor = 'var(--gray-100)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'progress') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Learner Progress
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              ...styles.tab,
              ...(activeTab === 'settings' ? styles.tabActive : {}),
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'settings') {
                e.currentTarget.style.backgroundColor = 'var(--gray-100)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'settings') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Settings
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {activeTab === 'courses' && (
          <div>
            <div style={styles.sectionHeader}>
              <h2>Course Management</h2>
              <button
                onClick={() => setShowCourseForm(!showCourseForm)}
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
                {showCourseForm ? 'Cancel' : '+ Create Course'}
              </button>
            </div>

            {showCourseForm && (
              <form onSubmit={handleCreateCourse} style={styles.form}>
                <div style={styles.formRow}>
                  <label style={styles.label}>Title *</label>
                  <input
                    type="text"
                    value={courseForm.title}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, title: e.target.value })
                    }
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    value={courseForm.description}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, description: e.target.value })
                    }
                    style={styles.textarea}
                  />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.label}>Activity ID (xAPI IRI) *</label>
                  <input
                    type="text"
                    value={courseForm.activityId}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, activityId: e.target.value })
                    }
                    required
                    style={styles.input}
                    placeholder="http://example.com/activity/course-1"
                  />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.label}>Blob Path *</label>
                  <input
                    type="text"
                    value={courseForm.blobPath}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, blobPath: e.target.value })
                    }
                    required
                    style={styles.input}
                    placeholder="courses/course-1/xapi/"
                  />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.label}>Launch File</label>
                  <input
                    type="text"
                    value={courseForm.launchFile}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, launchFile: e.target.value })
                    }
                    style={styles.input}
                  />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.label}>Thumbnail URL</label>
                  <input
                    type="url"
                    value={courseForm.thumbnailUrl}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, thumbnailUrl: e.target.value })
                    }
                    style={styles.input}
                  />
                </div>
                <button
                  type="submit"
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
                  Create Course
                </button>
              </form>
            )}

            {loading ? (
              <div style={styles.loading}>Loading courses...</div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--gray-50)' }}>
                      <th style={styles.tableHeader}>Title</th>
                      <th style={styles.tableHeader}>Activity ID</th>
                      <th style={styles.tableHeader}>Enrollments</th>
                      <th style={styles.tableHeader}>Attempts</th>
                      <th style={styles.tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr
                        key={course.courseId}
                        style={{
                          borderBottom: '1px solid var(--gray-200)',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <td style={{ padding: '1rem' }}>{course.title}</td>
                        <td style={{ ...styles.smallText, padding: '1rem' }}>{course.activityId}</td>
                        <td style={{ padding: '1rem' }}>{course.enrollmentCount}</td>
                        <td style={{ padding: '1rem' }}>{course.attemptCount}</td>
                        <td style={{ padding: '1rem' }}>
                          <button
                            onClick={() => handleDeleteCourse(course.courseId)}
                            style={styles.deleteButton}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--danger-light)';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--danger)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div>
            <h2>Learner Progress</h2>
            {loading ? (
              <div style={styles.loading}>Loading progress...</div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--gray-50)' }}>
                      <th style={styles.tableHeader}>Learner</th>
                      <th style={styles.tableHeader}>Course</th>
                      <th style={styles.tableHeader}>Enrolled</th>
                      <th style={styles.tableHeader}>Status</th>
                      <th style={styles.tableHeader}>Started</th>
                      <th style={styles.tableHeader}>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((item, idx) => (
                      <tr
                        key={`${item.userId}-${item.courseId}-${idx}`}
                        style={{
                          borderBottom: '1px solid var(--gray-200)',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <td style={{ padding: '1rem' }}>
                          {item.firstName} {item.lastName}
                          <br />
                          <span style={styles.smallText}>{item.email}</span>
                        </td>
                        <td style={{ padding: '1rem' }}>{item.courseTitle}</td>
                        <td style={{ padding: '1rem' }}>{new Date(item.enrolledAt).toLocaleDateString()}</td>
                        <td style={{ padding: '1rem' }}>{item.enrollmentStatus}</td>
                        <td style={{ padding: '1rem' }}>
                          {item.startedAt
                            ? new Date(item.startedAt).toLocaleDateString()
                            : '-'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {item.completedAt
                            ? new Date(item.completedAt).toLocaleDateString()
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <h2>LRS Configuration</h2>
            <p style={styles.info}>
              LRS settings are configured via environment variables on the server.
              Contact your system administrator to update these settings.
            </p>
            <div style={styles.settingsCard}>
              <h3>Current Configuration Status</h3>
              <p>Endpoint: Configured</p>
              <p>Authentication: Configured</p>
            </div>
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
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem',
    borderBottom: '2px solid var(--gray-200)',
    backgroundColor: 'white',
    padding: '0.5rem',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '1rem',
    color: 'var(--gray-600)',
    fontWeight: '500',
    transition: 'all var(--transition-base)',
    borderRadius: 'var(--radius-sm)',
  },
  tabActive: {
    color: 'var(--primary)',
    borderBottomColor: 'var(--primary)',
    backgroundColor: 'var(--gray-50)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  form: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: 'var(--radius-lg)',
    marginBottom: '2rem',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--gray-200)',
  },
  formRow: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    border: '2px solid var(--gray-200)',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    transition: 'all var(--transition-base)',
    backgroundColor: 'white',
    color: 'var(--gray-800)',
  },
  textarea: {
    width: '100%',
    padding: '0.875rem 1rem',
    border: '2px solid var(--gray-200)',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    minHeight: '100px',
    resize: 'vertical',
    transition: 'all var(--transition-base)',
    backgroundColor: 'white',
    color: 'var(--gray-800)',
    fontFamily: 'inherit',
  },
  button: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
  },
  deleteButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--danger)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all var(--transition-base)',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--gray-200)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  smallText: {
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
  },
  tableHeader: {
    padding: '1rem',
    textAlign: 'left',
    fontWeight: '600',
    color: 'var(--gray-700)',
    borderBottom: '2px solid var(--gray-200)',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    color: '#666',
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
  info: {
    color: 'var(--gray-600)',
    marginBottom: '1rem',
    lineHeight: '1.6',
  },
  settingsCard: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--gray-200)',
  },
};


