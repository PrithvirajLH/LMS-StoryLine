import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Download, Filter, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface SummaryRow {
  providerId: string;
  providerName: string;
  activeLearners: number;
  assigned: number;
  completed: number;
  completedOnTime: number;
  completedLate: number;
  notComplete: number;
  compliantPercent: number;
}

interface SummaryTotals {
  assigned: number;
  completed: number;
  completedOnTime: number;
  completedLate: number;
  notComplete: number;
  compliantPercent: number;
}

interface DetailRow {
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  assignedAt?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  completionStatus?: string | null;
  status: string;
}

const primaryColor = "#881337";
const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const content = rows.map(row => row.map(value => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }).join(",")).join("\r\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

const getDefaultRange = (dateType: string) => {
  const now = new Date();
  if (dateType === "completion") {
    const start = new Date(now.getTime() - 30 * DAY_MS);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
    };
  }
  const end = new Date(now.getTime() + 30 * DAY_MS);
  return {
    startDate: "",
    endDate: end.toISOString().slice(0, 10),
  };
};

export default function ActivityReport() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [providerId, setProviderId] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [dateType, setDateType] = useState("due");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [totals, setTotals] = useState<SummaryTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailProvider, setDetailProvider] = useState<Provider | null>(null);

  useEffect(() => {
    const defaults = getDefaultRange(dateType);
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
  }, [dateType]);

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const [providersResponse, coursesResponse] = await Promise.all([
        api.get("/api/admin/providers"),
        api.get("/api/admin/courses")
      ]);
      setProviders(providersResponse.data || []);
      setCourses(coursesResponse.data || []);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load filters";
      toast.error(message);
    }
  };

  const loadSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("providerId", providerId);
      params.set("courseId", courseId);
      params.set("dateType", dateType);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await api.get(`/api/admin/reports/activity/summary?${params.toString()}`);
      setSummaryRows(response.data?.rows || []);
      setTotals(response.data?.totals || null);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load report";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (provider: Provider) => {
    try {
      const params = new URLSearchParams();
      params.set("providerId", provider.providerId);
      params.set("courseId", courseId);
      params.set("dateType", dateType);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await api.get(`/api/admin/reports/activity/users?${params.toString()}`);
      setDetailRows(response.data?.rows || []);
      setDetailProvider(provider);
      setDetailOpen(true);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load provider detail";
      toast.error(message);
    }
  };

  const summaryTotals = useMemo(() => {
    if (totals) return totals;
    return summaryRows.reduce((acc, row) => ({
      assigned: acc.assigned + row.assigned,
      completed: acc.completed + row.completed,
      completedOnTime: acc.completedOnTime + row.completedOnTime,
      completedLate: acc.completedLate + row.completedLate,
      notComplete: acc.notComplete + row.notComplete,
      compliantPercent: acc.compliantPercent,
    }), { assigned: 0, completed: 0, completedOnTime: 0, completedLate: 0, notComplete: 0, compliantPercent: 0 });
  }, [summaryRows, totals]);

  const exportSummary = () => {
    if (!summaryRows.length) {
      toast.error("No summary data to export");
      return;
    }
    const header = [
      "provider",
      "active_learners",
      "assigned",
      "completed",
      "completed_on_time",
      "completed_late",
      "not_complete",
      "compliant_percent"
    ];
    const rows = [
      header,
      ...summaryRows.map(row => [
        row.providerName,
        String(row.activeLearners),
        String(row.assigned),
        String(row.completed),
        String(row.completedOnTime),
        String(row.completedLate),
        String(row.notComplete),
        String(row.compliantPercent)
      ])
    ];
    downloadCsv("activity-report-summary.csv", rows);
    toast.success("Summary exported");
  };

  const exportAllUsers = async () => {
    if (providerId === "all") {
      toast.error("Select a provider to export all users");
      return;
    }
    const provider = providers.find(p => p.providerId === providerId);
    if (!provider) {
      toast.error("Provider not found");
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("providerId", providerId);
      params.set("courseId", courseId);
      params.set("dateType", dateType);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await api.get(`/api/admin/reports/activity/users?${params.toString()}`);
      const rows = response.data?.rows || [];
      if (!rows.length) {
        toast.error("No user data to export");
        return;
      }
      const header = [
        "user",
        "course",
        "assigned_at",
        "due_date",
        "completed_at",
        "status"
      ];
      const csvRows = [
        header,
        ...rows.map((row: DetailRow) => [
          row.userName,
          row.courseTitle,
          row.assignedAt || "",
          row.dueDate || "",
          row.completedAt || "",
          row.status
        ])
      ];
      downloadCsv("activity-report-users.csv", csvRows);
      toast.success("User report exported");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to export users";
      toast.error(message);
    }
  };

  return (
    <>
      <Helmet>
        <title>Activity Report | LMS Admin</title>
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
              Activity Report
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              Track compliance and completion by provider.
            </p>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pt-6 pb-8 space-y-6">
            <Card className="bg-muted/40 border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Filter className="h-5 w-5" style={{ color: primaryColor }} />
                  Filters
                </CardTitle>
                <CardDescription>Filter by provider, course, and date range.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger className="w-[220px] h-11">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      {providers.map((provider) => (
                        <SelectItem key={provider.providerId} value={provider.providerId}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="w-[220px] h-11">
                      <SelectValue placeholder="Course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Courses</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.courseId} value={course.courseId}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={dateType} onValueChange={setDateType}>
                    <SelectTrigger className="w-[200px] h-11">
                      <SelectValue placeholder="Date type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due">Course Due Date</SelectItem>
                      <SelectItem value="completion">Completion Date</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[170px] h-11"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[170px] h-11"
                  />

                  <Button onClick={loadSummary} disabled={loading} className="h-11">
                    {loading ? "Loading..." : "Load Report"}
                  </Button>
                  <Button variant="outline" onClick={exportSummary} className="h-11">
                    <Download className="h-4 w-4 mr-2" />
                    Export Summary
                  </Button>
                  <Button variant="outline" onClick={exportAllUsers} className="h-11">
                    <Download className="h-4 w-4 mr-2" />
                    Export All Users
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-muted/40 border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Courses Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">{summaryTotals.completed}</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/40 border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Completed Late</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">{summaryTotals.completedLate}</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/40 border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Compliant %</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">{summaryTotals.compliantPercent}%</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-muted/40 border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Providers</CardTitle>
                <CardDescription>Training status by provider.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Provider</TableHead>
                        <TableHead className="font-semibold text-foreground">Active Learners</TableHead>
                        <TableHead className="font-semibold text-foreground">Assigned</TableHead>
                        <TableHead className="font-semibold text-foreground">Completed</TableHead>
                        <TableHead className="font-semibold text-foreground">Completed On Time</TableHead>
                        <TableHead className="font-semibold text-foreground">Completed Late</TableHead>
                        <TableHead className="font-semibold text-foreground">Not Complete</TableHead>
                        <TableHead className="font-semibold text-foreground">Compliant %</TableHead>
                        <TableHead className="font-semibold text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                            Load the report to see provider data.
                          </TableCell>
                        </TableRow>
                      ) : (
                        summaryRows.map((row) => (
                          <TableRow key={row.providerId} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{row.providerName}</TableCell>
                            <TableCell>{row.activeLearners}</TableCell>
                            <TableCell>{row.assigned}</TableCell>
                            <TableCell>{row.completed}</TableCell>
                            <TableCell>{row.completedOnTime}</TableCell>
                            <TableCell>{row.completedLate}</TableCell>
                            <TableCell>{row.notComplete}</TableCell>
                            <TableCell>{row.compliantPercent}%</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => loadDetail({ providerId: row.providerId, name: row.providerName })}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{detailProvider?.name || "Provider"} - User Detail</DialogTitle>
            <DialogDescription>Assignments for the selected provider.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">User</TableHead>
                  <TableHead className="font-semibold text-foreground">Course</TableHead>
                  <TableHead className="font-semibold text-foreground">Assigned</TableHead>
                  <TableHead className="font-semibold text-foreground">Due</TableHead>
                  <TableHead className="font-semibold text-foreground">Completed</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No results for this provider.
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRows.map((row) => (
                    <TableRow key={`${row.userId}-${row.courseId}`}>
                      <TableCell className="text-sm">{row.userName}</TableCell>
                      <TableCell className="text-sm">{row.courseTitle}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.assignedAt)}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.dueDate)}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.completedAt)}</TableCell>
                      <TableCell className="text-sm">{row.status.replace(/_/g, " ")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
