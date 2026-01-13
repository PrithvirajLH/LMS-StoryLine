import { Canvas } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial } from "@react-three/drei";
import { motion } from "framer-motion";

interface LiquidProgressProps {
  progress: number; // 0-100
  size?: number;
}

function LiquidSphere({ progress, size = 1 }: { progress: number; size: number }) {
  const fillLevel = progress / 100;
  const color = progress < 33 ? "#FF6B9D" : progress < 66 ? "#4ECDC4" : "#8B5FBF";

  return (
    <Sphere args={[size, 64, 64]} scale={[1, 1, fillLevel]}>
      <MeshDistortMaterial
        color={color}
        attach="material"
        distort={0.3 * fillLevel}
        speed={1.5}
        roughness={0.1}
        metalness={0.3}
      />
    </Sphere>
  );
}

export default function LiquidProgress({ progress, size = 1 }: LiquidProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-32 h-32"
    >
      <Canvas camera={{ position: [0, 0, 3] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <LiquidSphere progress={progress} size={size} />
      </Canvas>
      <div className="text-center mt-2">
        <p className="text-2xl font-serif font-bold">{Math.round(progress)}%</p>
      </div>
    </motion.div>
  );
}
