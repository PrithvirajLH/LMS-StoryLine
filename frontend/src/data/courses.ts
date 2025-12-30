export interface Course {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  thumbnail: string;
  instructor: string;
  instructorAvatar: string;
  duration: string;
  students: number;
  rating: number;
  reviews: number;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  modules: {
    title: string;
    lessons: {
      title: string;
      duration: string;
      completed?: boolean;
    }[];
  }[];
  skills: string[];
  requirements: string[];
}

export const courses: Course[] = [
  {
    id: "1",
    title: "Complete Web Development Bootcamp 2024",
    description: "Master HTML, CSS, JavaScript, React, Node.js and more in this comprehensive course.",
    longDescription: "Become a full-stack web developer with this comprehensive course. You'll learn everything from HTML and CSS basics to advanced React patterns, Node.js backend development, and database management. This course includes real-world projects and hands-on exercises.",
    thumbnail: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&auto=format&fit=crop&q=60",
    instructor: "Sarah Chen",
    instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60",
    duration: "48 hours",
    students: 12847,
    rating: 4.8,
    reviews: 2341,
    category: "Development",
    level: "Beginner",
    modules: [
      {
        title: "Getting Started",
        lessons: [
          { title: "Course Introduction", duration: "5 min", completed: true },
          { title: "Setting Up Your Environment", duration: "15 min", completed: true },
          { title: "HTML Fundamentals", duration: "45 min", completed: false },
        ],
      },
      {
        title: "CSS Mastery",
        lessons: [
          { title: "CSS Basics & Selectors", duration: "30 min" },
          { title: "Flexbox Deep Dive", duration: "45 min" },
          { title: "CSS Grid Layout", duration: "40 min" },
        ],
      },
      {
        title: "JavaScript Essentials",
        lessons: [
          { title: "Variables & Data Types", duration: "35 min" },
          { title: "Functions & Scope", duration: "40 min" },
          { title: "DOM Manipulation", duration: "50 min" },
        ],
      },
    ],
    skills: ["HTML5", "CSS3", "JavaScript", "React", "Node.js", "MongoDB"],
    requirements: ["No prior experience needed", "Computer with internet access", "Desire to learn"],
  },
  {
    id: "2",
    title: "Advanced Data Science with Python",
    description: "Deep dive into machine learning, data analysis, and AI with Python programming.",
    longDescription: "Take your data science skills to the next level with advanced machine learning algorithms, deep learning with TensorFlow and PyTorch, and real-world data analysis projects.",
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60",
    instructor: "Dr. Michael Torres",
    instructorAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=60",
    duration: "62 hours",
    students: 8932,
    rating: 4.9,
    reviews: 1876,
    category: "Data Science",
    level: "Advanced",
    modules: [
      {
        title: "Python for Data Science",
        lessons: [
          { title: "NumPy Fundamentals", duration: "45 min" },
          { title: "Pandas Deep Dive", duration: "60 min" },
          { title: "Data Visualization", duration: "50 min" },
        ],
      },
      {
        title: "Machine Learning",
        lessons: [
          { title: "Supervised Learning", duration: "90 min" },
          { title: "Unsupervised Learning", duration: "75 min" },
          { title: "Model Evaluation", duration: "45 min" },
        ],
      },
    ],
    skills: ["Python", "NumPy", "Pandas", "Scikit-learn", "TensorFlow", "Data Visualization"],
    requirements: ["Basic Python knowledge", "Understanding of statistics", "Linear algebra basics"],
  },
  {
    id: "3",
    title: "UI/UX Design Masterclass",
    description: "Learn to create beautiful, user-centered designs using Figma and design thinking.",
    longDescription: "Master the art and science of user interface and user experience design. Learn design thinking, prototyping, user research, and create stunning designs with Figma.",
    thumbnail: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&auto=format&fit=crop&q=60",
    instructor: "Emma Rodriguez",
    instructorAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=60",
    duration: "36 hours",
    students: 6421,
    rating: 4.7,
    reviews: 1234,
    category: "Design",
    level: "Intermediate",
    modules: [
      {
        title: "Design Fundamentals",
        lessons: [
          { title: "Design Principles", duration: "40 min" },
          { title: "Color Theory", duration: "35 min" },
          { title: "Typography", duration: "30 min" },
        ],
      },
      {
        title: "Figma Mastery",
        lessons: [
          { title: "Figma Interface", duration: "25 min" },
          { title: "Components & Variants", duration: "45 min" },
          { title: "Prototyping", duration: "50 min" },
        ],
      },
    ],
    skills: ["Figma", "UI Design", "UX Research", "Prototyping", "Design Systems", "User Testing"],
    requirements: ["No design experience required", "Figma account (free)", "Creative mindset"],
  },
  {
    id: "4",
    title: "Cloud Architecture with AWS",
    description: "Build scalable, resilient applications using Amazon Web Services cloud platform.",
    longDescription: "Become an AWS certified solutions architect. Learn to design and deploy scalable, highly available systems on AWS. Covers EC2, S3, Lambda, and more.",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=60",
    instructor: "James Wilson",
    instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60",
    duration: "54 hours",
    students: 5678,
    rating: 4.8,
    reviews: 987,
    category: "Cloud",
    level: "Intermediate",
    modules: [
      {
        title: "AWS Fundamentals",
        lessons: [
          { title: "AWS Overview", duration: "30 min" },
          { title: "IAM & Security", duration: "45 min" },
          { title: "EC2 Instances", duration: "60 min" },
        ],
      },
    ],
    skills: ["AWS", "EC2", "S3", "Lambda", "CloudFormation", "VPC"],
    requirements: ["Basic networking knowledge", "Some programming experience", "AWS free tier account"],
  },
  {
    id: "5",
    title: "Cybersecurity Fundamentals",
    description: "Learn ethical hacking, penetration testing, and security best practices.",
    longDescription: "Protect systems and networks from cyber threats. Learn ethical hacking techniques, vulnerability assessment, and security hardening strategies used by professionals.",
    thumbnail: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=60",
    instructor: "Alex Kim",
    instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=60",
    duration: "42 hours",
    students: 4532,
    rating: 4.6,
    reviews: 756,
    category: "Security",
    level: "Beginner",
    modules: [
      {
        title: "Security Basics",
        lessons: [
          { title: "Threat Landscape", duration: "35 min" },
          { title: "Network Security", duration: "50 min" },
          { title: "Cryptography Basics", duration: "45 min" },
        ],
      },
    ],
    skills: ["Ethical Hacking", "Penetration Testing", "Network Security", "Cryptography", "Risk Assessment"],
    requirements: ["Basic IT knowledge", "Interest in security", "Legal understanding"],
  },
  {
    id: "6",
    title: "Mobile App Development with React Native",
    description: "Build cross-platform mobile apps for iOS and Android using React Native.",
    longDescription: "Create beautiful, performant mobile applications that run on both iOS and Android from a single codebase. Learn React Native, state management, and native modules.",
    thumbnail: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop&q=60",
    instructor: "Lisa Park",
    instructorAvatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&auto=format&fit=crop&q=60",
    duration: "38 hours",
    students: 7234,
    rating: 4.7,
    reviews: 1123,
    category: "Development",
    level: "Intermediate",
    modules: [
      {
        title: "React Native Basics",
        lessons: [
          { title: "Environment Setup", duration: "25 min" },
          { title: "Core Components", duration: "40 min" },
          { title: "Styling & Layout", duration: "35 min" },
        ],
      },
    ],
    skills: ["React Native", "JavaScript", "Mobile Development", "Redux", "API Integration"],
    requirements: ["JavaScript knowledge", "React basics", "Mac for iOS development (optional)"],
  },
];

export const categories = [
  { name: "All", count: courses.length },
  { name: "Development", count: courses.filter(c => c.category === "Development").length },
  { name: "Data Science", count: courses.filter(c => c.category === "Data Science").length },
  { name: "Design", count: courses.filter(c => c.category === "Design").length },
  { name: "Cloud", count: courses.filter(c => c.category === "Cloud").length },
  { name: "Security", count: courses.filter(c => c.category === "Security").length },
];
