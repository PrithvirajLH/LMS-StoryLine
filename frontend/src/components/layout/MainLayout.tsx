import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

// ============================================================
// NAVIGATION STYLE TOGGLE
// ============================================================
// To switch navigation styles, change the import and NAV_STYLE:
//
// OPTION 1: Sidebar (vertical, fixed left)
import { Sidebar as Navigation } from "@/components/Sidebar";
const NAV_STYLE: "sidebar" | "nowbar" = "sidebar";
//
// OPTION 2: NowBar (horizontal, floating bottom)
// import { NowBar as Navigation } from "@/components/NowBar";
// const NAV_STYLE: "sidebar" | "nowbar" = "nowbar";
// ============================================================

type NavMode = "learner" | "admin" | "manager" | "coordinator" | "coach" | "corporate";

interface MainLayoutProps {
  children: ReactNode;
  navMode?: NavMode;
}

export const MainLayout = ({ children, navMode = "learner" }: MainLayoutProps) => {
  const location = useLocation();
  const isOnCoursePlayerPage = location.pathname.startsWith("/learner/player/");

  // Course player page - full screen, no navigation
  if (isOnCoursePlayerPage) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 flex flex-col bg-background overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  // Sidebar layout
  if (NAV_STYLE === "sidebar") {
    return (
      <div className="min-h-screen bg-background flex">
        <Navigation mode={navMode} />
        <main className="flex-1 flex flex-col bg-background overflow-hidden min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  // NowBar layout
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col bg-background overflow-hidden">
        {children}
      </main>
      <Navigation mode={navMode} />
    </div>
  );
};
