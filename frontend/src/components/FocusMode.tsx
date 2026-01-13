import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FocusModeProps {
  children: React.ReactNode;
}

export default function FocusMode({ children }: FocusModeProps) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isActive) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isActive]);

  return (
    <>
      <AnimatePresence>
        {!isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 z-50"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActive(true)}
              className="glass-sm"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              Focus Mode
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isActive && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setIsActive(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-4 right-4 z-50"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsActive(false)}
                className="glass-sm bg-background"
              >
                <Minimize2 className="h-4 w-4 mr-2" />
                Exit Focus
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 pointer-events-none"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="max-w-5xl w-full mx-auto px-8">
                  {children}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!isActive && children}
    </>
  );
}
