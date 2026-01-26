import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useState } from 'react';
import ProgressIndicator from './ProgressIndicator';
import { Badge } from '@/components/ui/badge';

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
    progressPercent?: number;
  };
  onEnroll?: (courseId: string) => void;
  onClick?: (courseId: string) => void;
  variant?: 'default' | 'poster';
}

export default function CourseCard({ course, onEnroll, onClick, variant = 'default' }: CourseCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-5, 5]);

  // Determine course status
  const isCompleted = 
    course.completionStatus === 'completed' || 
    course.completionStatus === 'passed' ||
    (course.score !== undefined && course.score >= 100) ||
    (course.progressPercent !== undefined && course.progressPercent >= 100);
  const isEnrolled = course.isEnrolled || course.enrollmentStatus === 'enrolled';
  const isInProgress = isEnrolled && !isCompleted;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (variant === 'poster') {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set((e.clientX - centerX) / rect.width);
      y.set((e.clientY - centerY) / rect.height);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  if (variant === 'poster') {
    // Landscape movie poster style - horizontal aspect ratio
    return (
      <motion.div
        className="group flex flex-col overflow-hidden cursor-pointer transition-all duration-300 border border-border/50 rounded-lg bg-card w-full"
        style={{
          height: '250px',
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={() => onClick && onClick(course.courseId)}
        whileHover={{ scale: 1.05, z: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Abstract 3D Placeholder or Thumbnail - Landscape */}
        <div className="relative w-full h-full overflow-hidden bg-gradient-accent">
          {course.thumbnailUrl ? (
            <>
              <img 
                src={course.thumbnailUrl} 
                alt={course.title}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
              />
              {/* Subtle vignette effect using multiple overlays */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-transparent to-black/10" />
              {/* Enhanced gradient overlay - more subtle and refined */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90 group-hover:opacity-95 transition-opacity duration-300" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
              <div className="w-32 h-32 rounded-full bg-gradient-vivid-1 opacity-80 animate-pulse-slow" />
            </div>
          )}
          
          {/* Status Badge */}
          <div className="absolute top-3 right-3 z-10">
            <Badge
              variant="secondary"
              className={`text-xs font-semibold shadow-lg backdrop-blur-md ${
                isCompleted
                  ? "bg-success/90 text-success-foreground border-success/50"
                  : isInProgress
                  ? "bg-primary/90 text-primary-foreground border-primary/50"
                  : "bg-background/95 text-foreground border-border/80 backdrop-blur-md"
              }`}
            >
              {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Enroll"}
            </Badge>
          </div>
        </div>

        {/* Minimal Text Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <h3 className="text-xl font-serif font-bold text-white mb-2 line-clamp-2 drop-shadow-lg">
            {course.title}
          </h3>
          {course.isEnrolled && course.score !== undefined && (
            <div className="text-sm text-white font-medium drop-shadow-md">
              {Math.round(course.score)}% Complete
            </div>
          )}
        </div>

      </motion.div>
    );
  }

  // Default grid style
  return (
    <div 
      className="glass-card group flex flex-col overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl border-border/50"
      onClick={() => onClick && onClick(course.courseId)}
    >
      {course.thumbnailUrl && (
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <img 
            src={course.thumbnailUrl} 
            alt={course.title}
            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-105"
          />
          {/* Subtle vignette effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Status Badge */}
          <div className="absolute top-3 right-3 z-10">
            <Badge
              variant="secondary"
              className={`text-xs font-semibold shadow-lg backdrop-blur-md ${
                isCompleted
                  ? "bg-success/90 text-success-foreground border-success/50"
                  : isInProgress
                  ? "bg-primary/90 text-primary-foreground border-primary/50"
                  : "bg-background/95 text-foreground border-border/80 backdrop-blur-md"
              }`}
            >
              {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Enroll"}
            </Badge>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-xl font-serif font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-200 flex-1">
            {course.title}
          </h3>
          {!course.thumbnailUrl && (
            <Badge
              variant="secondary"
              className={`text-xs font-medium flex-shrink-0 ${
                isCompleted
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : isInProgress
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "bg-background/80 text-foreground border-border backdrop-blur-sm"
              }`}
            >
              {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Enroll"}
            </Badge>
          )}
        </div>
        {course.description && (
          <p className="text-sm text-muted-foreground mb-4 flex-1 line-clamp-2 leading-relaxed">
            {course.description}
          </p>
        )}
        
        {course.isEnrolled && (
          <div className="mb-4">
            <ProgressIndicator
              status={course.completionStatus || 'not_started'}
              score={course.score}
            />
          </div>
        )}

        <div className={course.isEnrolled ? "mt-auto" : "mt-2"}>
          {course.isEnrolled ? (
            <Link
              to={`/learner/player/${course.courseId}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-full px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-brand shadow-md hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              {course.completionStatus === 'completed' || course.completionStatus === 'passed'
                ? 'Review Course'
                : 'Continue Learning'}
            </Link>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEnroll && onEnroll(course.courseId);
              }}
              className="w-full px-6 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-success to-success/80 shadow-md hover:shadow-lg hover:shadow-success/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Enroll Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
