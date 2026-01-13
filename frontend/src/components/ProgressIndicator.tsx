interface ProgressIndicatorProps {
  status: string;
  score?: number | null;
}

export default function ProgressIndicator({ status, score }: ProgressIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
      case 'passed':
        return 'bg-success text-success-foreground';
      case 'failed':
        return 'bg-destructive text-destructive-foreground';
      case 'in_progress':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-muted text-muted-foreground';
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
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span
          className={`px-3.5 py-1.5 rounded-full text-sm font-semibold text-white shadow-md ${getStatusColor()}`}
        >
          {getStatusText()}
        </span>
        {score !== null && score !== undefined && (
          <span className="text-sm text-muted-foreground font-medium">
            Score: {score}%
          </span>
        )}
      </div>
      {status === 'in_progress' && (
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${getStatusColor().split(' ')[0]}`}
            style={{ width: '60%' }} // This would come from actual progress data
          />
        </div>
      )}
    </div>
  );
}
