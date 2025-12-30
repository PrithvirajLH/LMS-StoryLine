import { useNavigate } from 'react-router-dom';
import { logout, getUser } from '../services/auth';

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const user = getUser();

  return (
    <header style={styles.header}>
      <div style={styles.leftSection}>
        <h1 style={styles.logo} onClick={() => navigate('/courses')}>
          🚀 Learn Swift Hub
        </h1>
        {title && <span style={styles.pageTitle}>{title}</span>}
      </div>
      <nav style={styles.nav}>
        <button
          onClick={() => navigate('/courses')}
          style={styles.navButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Courses
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          style={styles.navButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          My Progress
        </button>
        {user?.isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            style={styles.navButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Admin
          </button>
        )}
        <div style={styles.userSection}>
          <span style={styles.userName}>
            {user?.firstName || user?.email?.split('@')[0]}
          </span>
          <button
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            style={styles.logoutButton}
          >
            Logout
          </button>
        </div>
      </nav>
    </header>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    backgroundColor: '#ffffff',
    padding: '1rem 2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    borderBottom: '1px solid #e9ecef',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  logo: {
    fontSize: '1.75rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  pageTitle: {
    fontSize: '1.1rem',
    color: '#495057',
    fontWeight: '500',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  navButton: {
    padding: '0.625rem 1.25rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#495057',
    fontSize: '0.95rem',
    fontWeight: '500',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginLeft: '1rem',
    paddingLeft: '1rem',
    borderLeft: '1px solid #e9ecef',
  },
  userName: {
    fontSize: '0.9rem',
    color: '#6c757d',
    fontWeight: '500',
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
};



