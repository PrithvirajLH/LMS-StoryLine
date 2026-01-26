import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "../services/api";
import { handleAuthResponse } from "../services/auth";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/login', { email: formData.email, password: formData.password });
      handleAuthResponse(response.data);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Sign In | Creative Learning</title>
        <meta name="description" content="Sign in to your Creative Learning account to access your courses and track your progress." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        {/* Left Panel - Minimal Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/95 to-foreground" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(0_0%_100%/0.05),_transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(0_0%_100%/0.03),_transparent_50%)]" />
          
          <div className="relative z-10 flex flex-col justify-center px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mb-8"
              >
                <img 
                  src="/assets/images/logo-full.png" 
                  alt="Creative Learning" 
                  className="h-12 w-auto object-contain brightness-0 invert"
                />
              </motion.div>
              <h1 className="text-5xl font-bold text-background mb-6 tracking-tight">
                Welcome Back
              </h1>
              <p className="text-lg text-background/80 mb-12 max-w-md leading-relaxed">
                Continue your learning journey and unlock your potential with our comprehensive platform.
              </p>

              <div className="space-y-4">
                {[
                  "Resume where you left off",
                  "Track your learning progress",
                  "Access your enrolled courses"
                ].map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                    className="flex items-center gap-4 text-background/90"
                  >
                    <div className="w-1 h-1 rounded-full bg-background/60" />
                    <span className="text-base">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Logo - Mobile */}
            <div className="flex items-center justify-center mb-12 lg:hidden">
              <img 
                src="/assets/images/logo-full.png" 
                alt="Creative Learning" 
                className="h-12 w-auto object-contain"
              />
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Sign in</h2>
              <p className="text-muted-foreground">Enter your credentials to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 h-12 border-border bg-background focus:border-foreground transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <button 
                    type="button" 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10 h-12 border-border bg-background focus:border-foreground transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Signing in..."
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-8">
              Don't have an account?{" "}
              <Link to="/register" className="text-foreground font-medium hover:underline transition-all">
                Register here
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Login;
