import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow-md">
                <GraduationCap className="h-6 w-6 text-accent-foreground" />
              </div>
              <span className="text-xl font-bold">Learn Swift Hub</span>
            </Link>
            <p className="text-primary-foreground/70 text-sm">
              Empowering learners worldwide with quality education and xAPI-powered progress tracking.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><Link to="/courses" className="hover:text-primary-foreground transition-colors">All Courses</Link></li>
              <li><Link to="/dashboard" className="hover:text-primary-foreground transition-colors">Dashboard</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Progress Tracking</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Certifications</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">About Us</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Careers</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Blog</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Help Center</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">Terms of Service</Link></li>
              <li><Link to="/" className="hover:text-primary-foreground transition-colors">API Documentation</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10 text-center text-sm text-primary-foreground/50">
          <p>© {new Date().getFullYear()} Learn Swift Hub. All rights reserved. Powered by xAPI.</p>
        </div>
      </div>
    </footer>
  );
};
