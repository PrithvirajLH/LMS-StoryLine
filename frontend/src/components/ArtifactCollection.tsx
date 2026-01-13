import { motion } from "framer-motion";
import Artifact from "./Artifact";

interface ArtifactData {
  id: string;
  type: "sphere" | "cube" | "torus" | "custom";
  color: string;
  name: string;
  unlockedAt: string;
  courseId: string;
}

interface ArtifactCollectionProps {
  artifacts: ArtifactData[];
}

export default function ArtifactCollection({ artifacts }: ArtifactCollectionProps) {
  if (artifacts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Complete courses to unlock artifacts</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="macro-padding py-12"
    >
      <h2 className="text-3xl font-serif font-bold mb-8">Your Collection</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {artifacts.map((artifact, index) => (
          <motion.div
            key={artifact.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Artifact {...artifact} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
