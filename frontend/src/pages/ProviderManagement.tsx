import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Building2, Plus, Trash2, Link2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "../services/api";

interface Provider {
  providerId: string;
  name: string;
}

interface Course {
  courseId: string;
  title: string;
}

interface ProviderCourse {
  providerId: string;
  courseId: string;
  title: string;
  assignedAt?: string | null;
}

const primaryColor = "#881337";

export default function ProviderManagement() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [providerCourses, setProviderCourses] = useState<ProviderCourse[]>([]);
  const [newProviderName, setNewProviderName] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProviders();
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedProviderId) {
      loadProviderCourses(selectedProviderId);
    } else {
      setProviderCourses([]);
    }
  }, [selectedProviderId]);

  const loadProviders = async () => {
    try {
      const response = await api.get("/api/admin/providers");
      setProviders(response.data || []);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load providers";
      toast.error(message);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await api.get("/api/admin/courses");
      setCourses(response.data || []);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load courses";
      toast.error(message);
    }
  };

  const loadProviderCourses = async (providerId: string) => {
    try {
      const response = await api.get(`/api/admin/providers/${providerId}/courses`);
      setProviderCourses(response.data || []);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load provider courses";
      toast.error(message);
    }
  };

  const handleCreateProvider = async () => {
    if (!newProviderName.trim()) {
      toast.error("Enter a provider name");
      return;
    }
    try {
      setLoading(true);
      const response = await api.post("/api/admin/providers", { name: newProviderName.trim() });
      setNewProviderName("");
      await loadProviders();
      setSelectedProviderId(response.data.providerId);
      toast.success("Provider created");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create provider";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    try {
      await api.delete(`/api/admin/providers/${providerId}`);
      if (selectedProviderId === providerId) {
        setSelectedProviderId("");
      }
      await loadProviders();
      toast.success("Provider deleted");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to delete provider";
      toast.error(message);
    }
  };

  const handleAssignCourse = async () => {
    if (!selectedProviderId || !selectedCourseId) {
      toast.error("Select a provider and course");
      return;
    }

    try {
      await api.post(`/api/admin/providers/${selectedProviderId}/courses`, { courseId: selectedCourseId });
      setSelectedCourseId("");
      await loadProviderCourses(selectedProviderId);
      toast.success("Course assigned");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to assign course";
      toast.error(message);
    }
  };

  const handleRemoveCourse = async (courseId: string) => {
    if (!selectedProviderId) return;
    try {
      await api.delete(`/api/admin/providers/${selectedProviderId}/courses/${courseId}`);
      await loadProviderCourses(selectedProviderId);
      toast.success("Course removed");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to remove course";
      toast.error(message);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const selectedProvider = providers.find(p => p.providerId === selectedProviderId);

  return (
    <>
      <Helmet>
        <title>Providers | LMS Admin</title>
      </Helmet>
      <div className="flex flex-col h-full bg-background">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="macro-padding py-8">
            <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-2">
              Providers
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              Manage facilities and assign courses by provider
            </p>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pt-6 pb-8 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
            <Card className="bg-muted/40 border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" style={{ color: primaryColor }} />
                  Providers
                </CardTitle>
                <CardDescription>Create and manage providers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="New provider name"
                    value={newProviderName}
                    onChange={(e) => setNewProviderName(e.target.value)}
                  />
                  <Button onClick={handleCreateProvider} disabled={loading}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                <div className="space-y-2">
                  {providers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No providers yet.</p>
                  ) : (
                    providers.map((provider) => (
                      <div
                        key={provider.providerId}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 transition ${
                          selectedProviderId === provider.providerId ? "border-rose-900 bg-white" : "border-border bg-background"
                        }`}
                      >
                        <button
                          type="button"
                          className="text-left flex-1"
                          onClick={() => setSelectedProviderId(provider.providerId)}
                        >
                          <div className="text-sm font-medium">{provider.name}</div>
                          <div className="text-xs text-muted-foreground">{provider.providerId}</div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteProvider(provider.providerId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/40 border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Link2 className="h-5 w-5" style={{ color: primaryColor }} />
                  Course Assignments
                </CardTitle>
                <CardDescription>
                  {selectedProvider ? `Assign courses to ${selectedProvider.name}.` : "Select a provider to manage courses."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedProvider ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger className="w-[280px] h-11">
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((course) => (
                            <SelectItem key={course.courseId} value={course.courseId}>
                              {course.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAssignCourse}>
                        Assign Course
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                            <TableHead className="font-semibold text-foreground">Course</TableHead>
                            <TableHead className="font-semibold text-foreground">Assigned</TableHead>
                            <TableHead className="font-semibold text-foreground w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerCourses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                No courses assigned yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            providerCourses.map((course) => (
                              <TableRow key={`${course.courseId}-${course.providerId}`}>
                                <TableCell className="text-sm">{course.title}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatDate(course.assignedAt)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRemoveCourse(course.courseId)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Pick a provider from the left to assign courses.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
