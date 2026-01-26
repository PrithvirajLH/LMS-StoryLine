import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "../services/api";
import { getUser } from "../services/auth";

interface Course {
  courseId: string;
  title: string;
}

interface ReportRow {
  id: string;
  username: string;
  courseTitle?: string | null;
  enrolledAt?: string | null;
  completedAt?: string | null;
}

const primaryColor = "#881337";

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const escapeCsvValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);

export default function AdminReports() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [pageSize, setPageSize] = useState("200");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportCourseTitle, setReportCourseTitle] = useState("");
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const response = await api.get("/api/admin/courses");
        setCourses(response.data || []);
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Failed to load courses");
      }
    };
    loadCourses();
  }, []);

  useEffect(() => {
    setReportRows([]);
    setReportCourseTitle("");
    setPageTokens([null]);
    setPageIndex(0);
    setNextToken(null);
  }, [selectedCourseId, pageSize]);

  const reportSummary = useMemo(() => {
    if (!reportRows.length) return "No results";
    return `${reportRows.length} record${reportRows.length === 1 ? "" : "s"} • Page ${pageIndex + 1}`;
  }, [reportRows.length, pageIndex]);

  const fetchReportPage = async (token: string | null, nextIndex: number, resetTokens = false) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("courseId", selectedCourseId || "all");
      params.set("limit", pageSize);
      if (token) params.set("continuationToken", token);

      const response = await api.get(`/api/admin/reports/users?${params.toString()}`);
      setReportRows(response.data?.rows || []);
      setReportCourseTitle(response.data?.courseTitle || "");
      setNextToken(response.data?.continuationToken || null);
      setPageIndex(nextIndex);
      setPageTokens(prev => {
        const base = resetTokens ? [null] : [...prev];
        base[nextIndex] = token;
        return base;
      });
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to load report";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    setPageTokens([null]);
    setPageIndex(0);
    setNextToken(null);
    await fetchReportPage(null, 0, true);
  };

  const handleNextPage = async () => {
    if (!nextToken) return;
    await fetchReportPage(nextToken, pageIndex + 1);
  };

  const handlePrevPage = async () => {
    if (pageIndex === 0) return;
    const prevToken = pageTokens[pageIndex - 1] || null;
    await fetchReportPage(prevToken, pageIndex - 1);
  };

  const fetchAllReportRows = async () => {
    let allRows: ReportRow[] = [];
    let token: string | null = null;
    let resolvedCourseTitle = reportCourseTitle;

    do {
      const params = new URLSearchParams();
      params.set("courseId", selectedCourseId || "all");
      params.set("limit", "1000");
      if (token) params.set("continuationToken", token);

      const response = await api.get(`/api/admin/reports/users?${params.toString()}`);
      const rows = response.data?.rows || [];
      if (!resolvedCourseTitle) {
        resolvedCourseTitle = response.data?.courseTitle || resolvedCourseTitle;
      }
      allRows = allRows.concat(rows);
      token = response.data?.continuationToken || null;
    } while (token);

    if (resolvedCourseTitle && !reportCourseTitle) {
      setReportCourseTitle(resolvedCourseTitle);
    }

    return allRows;
  };

  const exportCsv = () => {
    const runExport = async () => {
      try {
        setExporting(true);
        const rows = await fetchAllReportRows();
        if (!rows.length) {
          toast.error("No report data to export");
          return;
        }
        const header = ["course_name", "id", "username", "enrolled_date", "completed_date"];
        const lines = [header.join(",")];
        rows.forEach((row) => {
          const courseName = row.courseTitle || reportCourseTitle || selectedCourseId;
          lines.push(
            [
              escapeCsvValue(courseName),
              escapeCsvValue(row.id),
              escapeCsvValue(row.username),
              escapeCsvValue(row.enrolledAt || ""),
              escapeCsvValue(row.completedAt || ""),
            ].join(",")
          );
        });
        const csvContent = lines.join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const anchor = document.createElement("a");
        const slugSource = reportCourseTitle || selectedCourseId || "course";
        const filename = `report-${slugify(slugSource) || "course"}.csv`;
        anchor.href = URL.createObjectURL(blob);
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
        toast.success("Report exported");
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Failed to export report");
      } finally {
        setExporting(false);
      }
    };

    runExport();
  };

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Reports | Creative Learning</title>
        <meta name="description" content="Export course enrollment and completion reports." />
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
              Reports
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              Export course enrollments with completion dates
            </p>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pt-6 pb-8">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                {error}
              </div>
            )}

            <Card className="bg-muted/40 border-border shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" style={{ color: primaryColor }} />
                  Enrollment Report
                </CardTitle>
                <CardDescription>
                  Filter by course and export learner enrollment details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="w-[260px] h-11">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Select course" />
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
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger className="w-[140px] h-11">
                    <SelectValue placeholder="Page size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 rows</SelectItem>
                    <SelectItem value="100">100 rows</SelectItem>
                    <SelectItem value="200">200 rows</SelectItem>
                    <SelectItem value="500">500 rows</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={loadReport} disabled={loading} className="h-11">
                  {loading ? "Loading..." : "Load Report"}
                </Button>
                <Button
                  variant="outline"
                  onClick={exportCsv}
                  disabled={loading || exporting}
                  className="h-11"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? "Exporting..." : "Export CSV"}
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-muted-foreground">{reportSummary}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePrevPage}
                    disabled={loading || pageIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleNextPage}
                    disabled={loading || !nextToken}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/40 border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  {reportCourseTitle ? `${reportCourseTitle} - Learners` : "Learners"}
                </CardTitle>
                <CardDescription>Enrollment and completion dates by user.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Course</TableHead>
                        <TableHead className="font-semibold text-foreground">ID</TableHead>
                        <TableHead className="font-semibold text-foreground">Username</TableHead>
                        <TableHead className="font-semibold text-foreground">Enrolled</TableHead>
                        <TableHead className="font-semibold text-foreground">Completed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportRows.length === 0 && !loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                            Select a course (or all courses) and load the report.
                          </TableCell>
                        </TableRow>
                      ) : (
                        reportRows.map((row) => (
                          <TableRow
                            key={`${row.courseTitle || "course"}-${row.id}-${row.enrolledAt || "na"}`}
                            className="hover:bg-muted/50"
                          >
                            <TableCell className="text-sm">
                              {row.courseTitle || reportCourseTitle || "-"}
                            </TableCell>
                            <TableCell className="text-sm font-mono">{row.id}</TableCell>
                            <TableCell className="text-sm">{row.username || "-"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDisplayDate(row.enrolledAt)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDisplayDate(row.completedAt)}
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
    </>
  );
}
