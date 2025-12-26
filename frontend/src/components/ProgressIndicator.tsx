interface ProgressIndicatorProps {
  status: string;
  score?: number | null;
}

export default function ProgressIndicator({ status, score }: ProgressIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
      case 'passed':
        return '#28a745';
      case 'failed':
        return '#dc3545';
      case 'in_progress':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'passed':
        return 'Passed';
      case 'failed':
        return 'Failed';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.status}>
        <span
          style={{
            ...styles.statusBadge,
            backgroundColor: getStatusColor(),
          }}
        >
          {getStatusText()}
        </span>
        {score !== null && score !== undefined && (
          <span style={styles.score}>Score: {score}%</span>
        )}
      </div>
      {status === 'in_progress' && (
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              backgroundColor: getStatusColor(),
              width: '60%', // This would come from actual progress data
            }}
          />
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
  },
  status: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  statusBadge: {
    padding: '0.375rem 0.875rem',
    borderRadius: 'var(--radius-lg)',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: '600',
    boxShadow: 'var(--shadow-sm)',
  },
  score: {
    fontSize: '0.875rem',
    color: '#666',
    fontWeight: '500',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
};


