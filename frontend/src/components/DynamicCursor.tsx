import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Play, HelpCircle } from "lucide-react";

export default function DynamicCursor() {
  const [cursorType, setCursorType] = useState<"default" | "play" | "question">("default");
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  const springConfig = { damping: 25, stiffness: 700 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    // Only enable on desktop and if user hasn't disabled it
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (!isDesktop) return;

    setIsEnabled(true);
    document.body.classList.add("dynamic-cursor-active");

    const updateCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if hovering over video or iframe
      if (target.tagName === "VIDEO" || target.closest("iframe") || target.closest("[data-video]")) {
        setCursorType("play");
      } 
      // Check if hovering over quiz or question elements
      else if (target.closest("[data-quiz]") || target.closest(".quiz") || target.closest("form")) {
        setCursorType("question");
      } 
      else {
        setCursorType("default");
      }
    };

    window.addEventListener("mousemove", updateCursor);
    window.addEventListener("mousemove", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.body.classList.remove("dynamic-cursor-active");
      window.removeEventListener("mousemove", updateCursor);
      window.removeEventListener("mousemove", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [cursorX, cursorY]);

  if (!isEnabled || !isVisible) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      {cursorType === "play" && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="w-12 h-12 rounded-full bg-gradient-accent flex items-center justify-center"
        >
          <Play className="h-6 w-6 text-white fill-white" />
        </motion.div>
      )}
      {cursorType === "question" && (
        <motion.div
          initial={{ scale: 0, rotate: 180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="w-12 h-12 rounded-full bg-gradient-vivid-2 flex items-center justify-center"
        >
          <HelpCircle className="h-6 w-6 text-white" />
        </motion.div>
      )}
      {cursorType === "default" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-6 h-6 rounded-full border-2 border-foreground"
        />
      )}
    </motion.div>
  );
}
