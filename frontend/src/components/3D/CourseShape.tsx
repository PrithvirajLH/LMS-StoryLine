import { Canvas } from "@react-three/fiber";
import { OrbitControls, Box, Sphere, Torus } from "@react-three/drei";
import { motion } from "framer-motion";

interface CourseShapeProps {
  type?: "management" | "coding" | "design" | "default";
  size?: number;
}

function Shape({ type, size = 1 }: { type: string; size: number }) {
  const color = type === "management" ? "#4ECDC4" : type === "coding" ? "#8B5FBF" : "#FF6B9D";

  if (type === "management") {
    // Balancing geometric sculpture
    return (
      <group>
        <Box args={[size * 0.8, size * 1.2, size * 0.3]} position={[0, size * 0.3, 0]}>
          <meshStandardMaterial color={color} />
        </Box>
        <Box args={[size * 1.2, size * 0.3, size * 0.3]} position={[0, -size * 0.3, 0]}>
          <meshStandardMaterial color={color} />
        </Box>
        <Sphere args={[size * 0.2]} position={[size * 0.6, size * 0.6, 0]}>
          <meshStandardMaterial color={color} />
        </Sphere>
      </group>
    );
  }

  if (type === "coding") {
    // Glowing, unraveling knot
    return (
      <Torus args={[size * 0.6, size * 0.2, 16, 100]} position={[0, 0, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </Torus>
    );
  }

  // Default sphere
  return (
    <Sphere args={[size, 32, 32]}>
      <meshStandardMaterial color={color} />
    </Sphere>
  );
}

export default function CourseShape({ type = "default", size = 1 }: CourseShapeProps) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 3] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Shape type={type} size={size} />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1} />
      </Canvas>
    </div>
  );
}
