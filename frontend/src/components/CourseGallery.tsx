import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import CourseCard from "./CourseCard";

interface Course {
  courseId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  isEnrolled: boolean;
  enrollmentStatus?: string;
  completionStatus?: string;
  score?: number;
  progressPercent?: number;
}

interface CourseGalleryProps {
  courses: Course[];
  onEnroll: (courseId: string) => void;
}

export default function CourseGallery({ courses, onEnroll }: CourseGalleryProps) {
  const navigate = useNavigate();

  const handleCourseClick = (courseId: string) => {
    navigate(`/player/${courseId}`);
  };

  return (
    <div className="relative">
      {/* Responsive Grid - Fits to screen, no horizontal scroll */}
      <div 
        className="grid course-gallery-grid gap-6 px-8"
        style={{
          gridAutoRows: 'minmax(250px, auto)',
        }}
      >
        {courses.map((course, index) => (
          <motion.div
            key={course.courseId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.5 }}
            className="w-full"
          >
            <div onClick={() => handleCourseClick(course.courseId)}>
              <CourseCard
                course={course}
                onEnroll={onEnroll}
                variant="poster"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
