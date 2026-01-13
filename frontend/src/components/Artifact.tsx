import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere, Box, Torus, MeshDistortMaterial } from "@react-three/drei";

interface ArtifactProps {
  type: "sphere" | "cube" | "torus" | "custom";
  color: string;
  name: string;
  unlockedAt: string;
}

function ArtifactShape({ type, color }: { type: string; color: string }) {
  if (type === "sphere") {
    return (
      <Sphere args={[1, 32, 32]}>
        <MeshDistortMaterial
          color={color}
          distort={0.3}
          speed={1.5}
          roughness={0.1}
          metalness={0.5}
        />
      </Sphere>
    );
  }
  
  if (type === "cube") {
    return (
      <Box args={[1, 1, 1]}>
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
      </Box>
    );
  }
  
  if (type === "torus") {
    return (
      <Torus args={[0.6, 0.2, 16, 100]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </Torus>
    );
  }
  
  return (
    <Sphere args={[1, 32, 32]}>
      <meshStandardMaterial color={color} />
    </Sphere>
  );
}

export default function Artifact({ type, color, name, unlockedAt }: ArtifactProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1, y: -10 }}
      className="flex flex-col items-center gap-4 p-6 glass-sm rounded-xl"
    >
      <div className="w-32 h-32">
        <Canvas camera={{ position: [0, 0, 3] }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <ArtifactShape type={type} color={color} />
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1} />
        </Canvas>
      </div>
      <div className="text-center">
        <h3 className="font-serif font-semibold text-foreground mb-1">{name}</h3>
        <p className="text-xs text-muted-foreground">{unlockedAt}</p>
      </div>
    </motion.div>
  );
}
