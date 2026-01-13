import { createContext, useContext, useState, ReactNode } from "react";

interface CurrentCourse {
  courseId: string;
  title: string;
  progress?: number;
}

interface CurrentCourseContextType {
  currentCourse: CurrentCourse | null;
  setCurrentCourse: (course: CurrentCourse | null) => void;
}

const CurrentCourseContext = createContext<CurrentCourseContextType | undefined>(undefined);

export const CurrentCourseProvider = ({ children }: { children: ReactNode }) => {
  const [currentCourse, setCurrentCourse] = useState<CurrentCourse | null>(null);

  return (
    <CurrentCourseContext.Provider value={{ currentCourse, setCurrentCourse }}>
      {children}
    </CurrentCourseContext.Provider>
  );
};

export const useCurrentCourse = () => {
  const context = useContext(CurrentCourseContext);
  if (context === undefined) {
    throw new Error("useCurrentCourse must be used within a CurrentCourseProvider");
  }
  return context;
};
