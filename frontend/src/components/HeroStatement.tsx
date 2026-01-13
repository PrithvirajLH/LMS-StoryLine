import { motion } from "framer-motion";
import { getUser } from "@/services/auth";
import HeroAnimation from "./3D/HeroAnimation";

export default function HeroStatement() {
  const user = getUser();
  const firstName = user?.firstName || "there";
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? "Good Morning" : timeOfDay < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="macro-padding py-24 lg:py-32"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
        <div className="relative z-10 lg:pr-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-5xl lg:text-7xl font-serif font-bold mb-6 leading-tight tracking-tight"
          >
            {greeting}, {firstName}.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-2xl lg:text-4xl font-serif font-light text-muted-foreground leading-relaxed"
          >
            Your mind is growing.
          </motion.p>
        </div>
        <div className="relative z-0 overflow-hidden">
          <HeroAnimation />
        </div>
      </div>
    </motion.div>
  );
}
