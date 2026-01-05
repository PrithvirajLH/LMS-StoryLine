import { ReactNode, useState } from "react";
import { Sidebar, useSidebar, SidebarContext } from "./Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

const MainContent = ({ children }: MainLayoutProps) => {
  const { isCollapsed } = useSidebar();
  
  return (
    <div className={`flex-1 transition-all duration-300 flex flex-col ${
      isCollapsed ? 'ml-16' : 'ml-64'
    }`}>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
};

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      <div className="min-h-screen bg-background flex">
        <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarContext.Provider>
  );
};

