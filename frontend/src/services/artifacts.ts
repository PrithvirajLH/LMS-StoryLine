// Frontend-only artifact management
// In a real app, this would sync with backend

export interface Artifact {
  id: string;
  type: "sphere" | "cube" | "torus" | "custom";
  color: string;
  name: string;
  unlockedAt: string;
  courseId: string;
  courseTitle: string;
}

const ARTIFACTS_STORAGE_KEY = "lms_artifacts";

export const getArtifacts = (): Artifact[] => {
  if (typeof window === "undefined") return [];
  
  const stored = localStorage.getItem(ARTIFACTS_STORAGE_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const addArtifact = (artifact: Omit<Artifact, "id" | "unlockedAt">): Artifact => {
  const artifacts = getArtifacts();
  const newArtifact: Artifact = {
    ...artifact,
    id: `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    unlockedAt: new Date().toLocaleDateString(),
  };
  
  artifacts.push(newArtifact);
  localStorage.setItem(ARTIFACTS_STORAGE_KEY, JSON.stringify(artifacts));
  
  return newArtifact;
};

export const unlockArtifactForCourse = (courseId: string, courseTitle: string): Artifact | null => {
  const artifacts = getArtifacts();
  
  // Check if artifact already exists for this course
  if (artifacts.some(a => a.courseId === courseId)) {
    return null;
  }
  
  // Determine artifact type and color based on course
  const artifactTypes: Array<"sphere" | "cube" | "torus"> = ["sphere", "cube", "torus"];
  const colors = ["#FF6B9D", "#4ECDC4", "#8B5FBF", "#FF8E53", "#44A08D"];
  
  const type = artifactTypes[artifacts.length % artifactTypes.length];
  const color = colors[artifacts.length % colors.length];
  
  return addArtifact({
    type,
    color,
    name: `${courseTitle} Achievement`,
    courseId,
    courseTitle,
  });
};
