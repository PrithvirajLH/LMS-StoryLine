import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { NowBar } from "@/components/NowBar";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  const isOnCoursePlayerPage = location.pathname.startsWith("/player/");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        {children}
      </main>
      {!isOnCoursePlayerPage && <NowBar />}
    </div>
  );
};
