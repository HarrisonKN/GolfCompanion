// app/components/CourseContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

type CourseContextType = {
  selectedCourse: string | null;
  setSelectedCourse: (id: string | null) => void;
};

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export function CourseProvider({ children }: { children: ReactNode }) {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  return (
    <CourseContext.Provider value={{ selectedCourse, setSelectedCourse }}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error("useCourse must be used inside CourseProvider");
  return ctx;
}
