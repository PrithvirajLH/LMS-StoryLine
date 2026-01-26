import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit, Trash2, Activity, FileText, Users, Settings, Search, Eye, Layers, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "../services/api";
import { getUser } from "../services/auth";

interface Course {
  courseId: string;
  title: string;
  modules?: Array<{ id: string; name: string }>;
}

interface ModuleRule {
  moduleId: string;
  moduleName?: string;
  matchType?: 'prefix' | 'contains';
  matchValue?: string;
  completionVerbs?: string[];
  scoreThreshold?: number | null;
}

interface KCAttempt {
  attemptId: string;
  userEmail: string;
  registrationId?: string | null;
  courseId?: string | null;
  activityId?: string | null;
  assessmentId?: string | null;
  assessmentName?: string | null;
  verbId?: string | null;
  success?: boolean | null;
  scoreScaled?: number | null;
  scoreRaw?: number | null;
  scoreMax?: number | null;
  response?: string | null;
  interactionType?: string | null;
  timestamp?: string | null;
  storedAt?: string | null;
}

interface KCScoreSummary {
  assessmentId: string;
  assessmentName?: string | null;
  attempts: number;
  scoredAttempts?: number;
  averageScorePercent?: number | null;
  bestScorePercent?: number | null;
  lastScorePercent?: number | null;
  successRatePercent?: number | null;
  lastAttemptAt?: string | null;
}

interface KCCourseUserSummary {
  userEmail: string;
  attempts: number;
  scoredAttempts?: number;
  averageScorePercent?: number | null;
  bestScorePercent?: number | null;
  lastScorePercent?: number | null;
  successRatePercent?: number | null;
  lastAttemptAt?: string | null;
}

type TabId = 'statistics' | 'module-rules' | 'inspector' | 'kc-attempts' | 'kc-scores' | 'custom-verbs';

interface AdminPanelProps {
  initialTab?: TabId;
  visibleTabs?: TabId[];
}

export default function AdminPanel({ initialTab, visibleTabs }: AdminPanelProps) {
  const resolvedTabs = useMemo<TabId[]>(() => {
    if (visibleTabs && visibleTabs.length > 0) {
      return visibleTabs;
    }
    return ['statistics', 'module-rules', 'inspector', 'kc-attempts', 'kc-scores', 'custom-verbs'];
  }, [visibleTabs]);
  const defaultTab = (initialTab && resolvedTabs.includes(initialTab)) ? initialTab : resolvedTabs[0];
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [verbStats, setVerbStats] = useState<any>({});
  const [verbConfigs, setVerbConfigs] = useState<any>({ standard: {}, custom: {} });
  const [customVerbs, setCustomVerbs] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [moduleCourseId, setModuleCourseId] = useState<string>('');
  const [statementCourseId, setStatementCourseId] = useState<string>('');
  const [moduleRules, setModuleRules] = useState<ModuleRule[]>([]);
  const [moduleRulesLoading, setModuleRulesLoading] = useState(false);
  const [moduleRulesDirty, setModuleRulesDirty] = useState(false);
  const [statements, setStatements] = useState<any[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [statementLimit, setStatementLimit] = useState('50');
  const [kcAttempts, setKcAttempts] = useState<KCAttempt[]>([]);
  const [kcLoading, setKcLoading] = useState(false);
  const [kcScores, setKcScores] = useState<KCScoreSummary[]>([]);
  const [kcCourseScores, setKcCourseScores] = useState<KCCourseUserSummary[]>([]);
  const [kcScoresLoading, setKcScoresLoading] = useState(false);
  const [kcUserEmail, setKcUserEmail] = useState('');
  const [kcCourseId, setKcCourseId] = useState('all');
  const [kcRegistrationId, setKcRegistrationId] = useState('');
  const [kcAssessmentId, setKcAssessmentId] = useState('');
  const [kcLimit, setKcLimit] = useState('50');
  const [showVerbDialog, setShowVerbDialog] = useState(false);
  const [editingVerb, setEditingVerb] = useState<string | null>(null);
  const [verbForm, setVerbForm] = useState({
    verbId: '',
    category: 'interaction',
    action: 'track_interaction',
    description: '',
  });
  const [verbSearchQuery, setVerbSearchQuery] = useState('');
  const [verbCategoryFilter, setVerbCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getUser();

  // Primary accent color
  const primaryColor = '#881337';

  useEffect(() => {
    loadVerbs();
    loadCourses();
  }, []);

  useEffect(() => {
    if (defaultTab && activeTab !== defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (moduleCourseId) {
      loadModuleRules(moduleCourseId);
    }
  }, [moduleCourseId]);

  useEffect(() => {
    if (statementCourseId) {
      setStatements([]);
    }
  }, [statementCourseId]);

  useEffect(() => {
    setKcAttempts([]);
    setKcScores([]);
    setKcCourseScores([]);
  }, [kcUserEmail, kcCourseId, kcRegistrationId, kcAssessmentId]);

  const loadVerbs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/admin/verbs');
      setVerbStats(response.data.statistics || {});
      setVerbConfigs(response.data.verbConfigs || { standard: {}, custom: {} });
      
      const custom = response.data.verbConfigs?.custom || {};
      setCustomVerbs(Object.entries(custom).map(([verbId, config]: [string, any]) => ({
        verbId,
        ...config
      })));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load verb statistics');
      toast.error(err.response?.data?.error || 'Failed to load verb statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await api.get('/api/admin/courses');
      setCourses(response.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load courses');
    }
  };

  const loadModuleRules = async (courseId: string) => {
    if (!courseId) return;
    try {
      setModuleRulesLoading(true);
      const response = await api.get(`/api/admin/module-rules?courseId=${encodeURIComponent(courseId)}`);
      setModuleRules(response.data.rules || []);
      setModuleRulesDirty(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load module rules');
    } finally {
      setModuleRulesLoading(false);
    }
  };

  const saveModuleRules = async () => {
    if (!moduleCourseId) return;
    try {
      await api.put(`/api/admin/module-rules?courseId=${encodeURIComponent(moduleCourseId)}`, {
        rules: moduleRules
      });
      toast.success('Module rules saved');
      setModuleRulesDirty(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save module rules');
    }
  };

  const loadStatements = async () => {
    if (!statementCourseId) return;
    try {
      setStatementsLoading(true);
      const response = await api.get(`/api/admin/statements?courseId=${encodeURIComponent(statementCourseId)}&limit=${encodeURIComponent(statementLimit)}`);
      setStatements(response.data.statements || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load statements');
    } finally {
      setStatementsLoading(false);
    }
  };

  const loadKcAttempts = async () => {
    if (!kcUserEmail && (!kcCourseId || kcCourseId === 'all')) {
      toast.error('Enter a user email or select a course');
      return;
    }
    try {
      setKcLoading(true);
      const params = new URLSearchParams();
      if (kcUserEmail) params.set('userEmail', kcUserEmail);
      if (kcCourseId && kcCourseId !== 'all') params.set('courseId', kcCourseId);
      if (kcRegistrationId) params.set('registrationId', kcRegistrationId);
      if (kcAssessmentId) params.set('assessmentId', kcAssessmentId);
      if (kcLimit) params.set('limit', kcLimit);

      const response = await api.get(`/api/admin/kc-attempts?${params.toString()}`);
      setKcAttempts(response.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load KC attempts');
    } finally {
      setKcLoading(false);
    }
  };

  const loadKcScores = async () => {
    if (!kcUserEmail && (!kcCourseId || kcCourseId === 'all')) {
      toast.error('Enter a user email or select a course');
      return;
    }
    try {
      setKcScoresLoading(true);
      const params = new URLSearchParams();
      if (kcUserEmail) params.set('userEmail', kcUserEmail);
      if (kcCourseId && kcCourseId !== 'all') params.set('courseId', kcCourseId);
      if (kcRegistrationId) params.set('registrationId', kcRegistrationId);
      if (kcAssessmentId) params.set('assessmentId', kcAssessmentId);
      if (kcLimit) params.set('limit', kcLimit);

      const response = await api.get(`/api/admin/kc-scores?${params.toString()}`);
      if (kcUserEmail) {
        setKcScores(response.data || []);
        setKcCourseScores([]);
      } else {
        setKcCourseScores(response.data || []);
        setKcScores([]);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load KC scores');
    } finally {
      setKcScoresLoading(false);
    }
  };

  const updateRuleField = (index: number, field: keyof ModuleRule, value: any) => {
    setModuleRules(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setModuleRulesDirty(true);
  };

  const addModuleRule = () => {
    const newRule: ModuleRule = {
      moduleId: `module-${Date.now()}`,
      moduleName: 'New Module',
      matchType: 'contains',
      matchValue: '',
      completionVerbs: ['experienced'],
      scoreThreshold: null,
    };
    setModuleRules(prev => [...prev, newRule]);
    setModuleRulesDirty(true);
    toast.info('New module rule added');
  };

  const removeModuleRule = (index: number) => {
    setModuleRules(prev => prev.filter((_, i) => i !== index));
    setModuleRulesDirty(true);
  };

  const handleModuleCourseChange = (courseId: string) => {
    if (moduleRulesDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard?');
      if (!confirmDiscard) return;
    }
    setModuleCourseId(courseId);
  };

  const handleAddVerb = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await api.post('/api/admin/verbs', {
        verbId: verbForm.verbId,
        config: {
          category: verbForm.category,
          action: verbForm.action,
          description: verbForm.description,
        }
      });
      toast.success('Custom verb added');
      setShowVerbDialog(false);
      setVerbForm({ verbId: '', category: 'interaction', action: 'track_interaction', description: '' });
      loadVerbs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add custom verb');
    }
  };

  const handleEditVerb = (verbId: string) => {
    const verb = customVerbs.find(v => v.verbId === verbId);
    if (verb) {
      setEditingVerb(verbId);
      setVerbForm({
        verbId: verb.verbId,
        category: verb.category || 'interaction',
        action: verb.action || 'track_interaction',
        description: verb.description || '',
      });
      setShowVerbDialog(true);
    }
  };

  const handleUpdateVerb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVerb) return;
    try {
      await api.put(`/api/admin/verbs/${encodeURIComponent(editingVerb)}`, {
        config: {
          category: verbForm.category,
          action: verbForm.action,
          description: verbForm.description,
        }
      });
      toast.success('Custom verb updated');
      setShowVerbDialog(false);
      setEditingVerb(null);
      setVerbForm({ verbId: '', category: 'interaction', action: 'track_interaction', description: '' });
      loadVerbs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update verb');
    }
  };

  const handleDeleteVerb = async (verbId: string) => {
    if (!confirm(`Delete the verb "${verbId}"?`)) return;
    try {
      await api.delete(`/api/admin/verbs/${encodeURIComponent(verbId)}`);
      toast.success('Verb deleted');
      loadVerbs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete verb');
    }
  };

  // Calculate stats
  const totalVerbs = (verbConfigs.standard ? Object.keys(verbConfigs.standard).length : 0) + customVerbs.length;
  const totalStatements = Object.values(verbStats).reduce((sum: number, stat: any) => sum + (stat.totalCount || 0), 0) as number;
  const uniqueUsers = new Set(Object.values(verbStats).flatMap((stat: any) => stat.users || [])).size;

  // Tabs configuration
  const tabDefinitions: { id: TabId; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'statistics', label: 'Verb Statistics', icon: <Activity className="h-4 w-4" />, description: 'View usage statistics' },
    { id: 'module-rules', label: 'Module Rules', icon: <Layers className="h-4 w-4" />, description: 'Configure completion rules' },
    { id: 'inspector', label: 'Statement Inspector', icon: <Eye className="h-4 w-4" />, description: 'Debug xAPI statements' },
    { id: 'kc-attempts', label: 'KC Attempts', icon: <FileText className="h-4 w-4" />, description: 'Review knowledge check attempts' },
    { id: 'kc-scores', label: 'KC Scores', icon: <Activity className="h-4 w-4" />, description: 'Review knowledge check scores' },
    { id: 'custom-verbs', label: 'Custom Verbs', icon: <Settings className="h-4 w-4" />, description: 'Manage custom verbs' },
  ];
  const tabs = tabDefinitions.filter(tab => resolvedTabs.includes(tab.id));
  const singleTabView = tabs.length === 1;
  const headerTab = singleTabView ? tabs[0] : null;

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

  // Get filtered verbs
  const getFilteredVerbs = () => {
    const allVerbs = new Map<string, any>();
    
    if (verbConfigs.standard) {
      Object.keys(verbConfigs.standard).forEach(verbId => {
        allVerbs.set(verbId, {
          verbId,
          totalCount: 0,
          uniqueUsers: 0,
          uniqueActivities: 0,
          lastUsed: null,
          ...verbStats[verbId]
        });
      });
    }
    
    if (verbConfigs.custom) {
      Object.keys(verbConfigs.custom).forEach(verbId => {
        allVerbs.set(verbId, {
          verbId,
          totalCount: 0,
          uniqueUsers: 0,
          uniqueActivities: 0,
          lastUsed: null,
          ...verbStats[verbId]
        });
      });
    }
    
    Object.keys(verbStats).forEach(verbId => {
      if (!allVerbs.has(verbId)) {
        allVerbs.set(verbId, verbStats[verbId]);
      }
    });
    
    return Array.from(allVerbs.entries())
      .filter(([verbId]) => {
        if (verbSearchQuery && !verbId.toLowerCase().includes(verbSearchQuery.toLowerCase())) return false;
        if (verbCategoryFilter !== 'all') {
          const config = verbConfigs.standard?.[verbId] || verbConfigs.custom?.[verbId];
          if (!config || config.category !== verbCategoryFilter) return false;
        }
        return true;
      })
      .sort(([, a]: [string, any], [, b]: [string, any]) => (b.totalCount || 0) - (a.totalCount || 0));
  };

  return (
    <>
      <Helmet>
        <title>xAPI Configuration | Creative Learning</title>
        <meta name="description" content="Monitor and manage xAPI verbs and module rules" />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="macro-padding py-8">
            <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-2">
              {headerTab ? headerTab.label : "xAPI Configuration"}
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              {headerTab ? headerTab.description : "Manage verbs, module rules, and inspect statements"}
            </p>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pt-6 pb-8">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20 text-base">
                {error}
              </div>
            )}

            {/* Quick Stats - Always visible, compact */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="bg-muted/40 border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{totalVerbs}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Total Verbs</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/40 border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{totalStatements}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Statements</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/40 border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{uniqueUsers}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Unique Users</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tab Navigation */}
            {!singleTabView && (
              <div className="flex gap-1.5 mb-6 p-1.5 bg-muted/60 rounded-xl border border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-rose-900 text-white shadow-md'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Statistics Tab */}
                {activeTab === 'statistics' && (
                  <Card className="bg-muted/40 border-border">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl font-semibold">Verb Statistics</CardTitle>
                          <CardDescription className="text-base">Usage statistics for all tracked xAPI verbs</CardDescription>
                        </div>
                        <div className="flex gap-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search verbs..."
                              value={verbSearchQuery}
                              onChange={(e) => setVerbSearchQuery(e.target.value)}
                              className="pl-10 w-[200px] h-10"
                            />
                          </div>
                          <Select value={verbCategoryFilter} onValueChange={setVerbCategoryFilter}>
                            <SelectTrigger className="w-[150px] h-10">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              <SelectItem value="completion">Completion</SelectItem>
                              <SelectItem value="progress">Progress</SelectItem>
                              <SelectItem value="interaction">Interaction</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                              <TableHead className="text-base font-semibold text-foreground">Verb ID</TableHead>
                              <TableHead className="text-base font-semibold text-foreground">Category</TableHead>
                              <TableHead className="text-base font-semibold text-foreground text-center">Count</TableHead>
                              <TableHead className="text-base font-semibold text-foreground text-center">Users</TableHead>
                              <TableHead className="text-base font-semibold text-foreground">Last Used</TableHead>
                              <TableHead className="text-base font-semibold text-foreground">Type</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loading ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    Loading statistics...
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : getFilteredVerbs().length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                  No verbs found matching your criteria
                                </TableCell>
                              </TableRow>
                            ) : getFilteredVerbs().map(([verbId, stat]: [string, any]) => {
                              const config = verbConfigs.standard?.[verbId] || verbConfigs.custom?.[verbId];
                              const isCustom = !!verbConfigs.custom?.[verbId];
                              const category = config?.category || 'unknown';
                              return (
                                <TableRow key={verbId} className="hover:bg-muted/50 border-b border-border">
                                  <TableCell className="font-mono text-sm max-w-xs truncate" title={verbId}>
                                    {verbId.split('/').pop() || verbId}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={
                                      category === 'completion' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
                                      category === 'progress' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                      category === 'interaction' ? 'border-purple-300 text-purple-700 bg-purple-50' :
                                      'border-gray-300 text-gray-700 bg-gray-50'
                                    }>
                                      {category}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center font-medium text-base">{stat.totalCount || 0}</TableCell>
                                  <TableCell className="text-center text-base">{stat.uniqueUsers || 0}</TableCell>
                                  <TableCell className="text-base text-muted-foreground">
                                    {stat.lastUsed ? new Date(stat.lastUsed).toLocaleDateString() : '—'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={isCustom ? "default" : "secondary"} className={isCustom ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : ""}>
                                      {isCustom ? 'Custom' : 'Standard'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Module Rules Tab */}
                {activeTab === 'module-rules' && (
                  <Card className="bg-muted/40 border-border">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl font-semibold">Course Module Rules</CardTitle>
                          <CardDescription className="text-base">Map Storyline modules to completion verbs and score thresholds</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Course Selector */}
                      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-background rounded-lg border border-border">
                        <div className="flex-1">
                          <Label htmlFor="courseSelect" className="text-base mb-2 block">Select Course</Label>
                          <Select value={moduleCourseId} onValueChange={handleModuleCourseChange}>
                            <SelectTrigger id="courseSelect" className="h-11">
                              <SelectValue placeholder="Choose a course to configure..." />
                            </SelectTrigger>
                            <SelectContent>
                              {courses.map(course => (
                                <SelectItem key={course.courseId} value={course.courseId}>
                                  {course.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {moduleCourseId && (
                          <div className="flex items-end gap-3">
                            {moduleRulesDirty && (
                              <Badge variant="outline" className="h-11 px-3 border-amber-300 text-amber-700 bg-amber-50">
                                Unsaved changes
                              </Badge>
                            )}
                            <Button variant="outline" onClick={addModuleRule} disabled={moduleRulesLoading} className="h-11">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Rule
                            </Button>
                            <Button onClick={saveModuleRules} disabled={moduleRulesLoading || !moduleRulesDirty} className="h-11">
                              Save Rules
                            </Button>
                          </div>
                        )}
                      </div>

                      {!moduleCourseId ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Select a course above to configure module rules</p>
                        </div>
                      ) : moduleRulesLoading ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                          <p>Loading module rules...</p>
                        </div>
                      ) : moduleRules.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg mb-2">No module rules configured</p>
                          <p className="text-base">Click "Add Rule" to create your first module rule</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {moduleRules.map((rule, index) => (
                            <motion.div
                              key={`${rule.moduleId}-${index}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="p-4 bg-background rounded-lg border border-border"
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                  <div>
                                    <Label className="text-sm text-muted-foreground mb-1 block">Module Name</Label>
                                    <Input
                                      value={rule.moduleName || rule.moduleId}
                                      onChange={(e) => updateRuleField(index, 'moduleName', e.target.value)}
                                      placeholder="Module name"
                                      className="h-10"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm text-muted-foreground mb-1 block">Match Type</Label>
                                    <Select
                                      value={rule.matchType || 'contains'}
                                      onValueChange={(value) => updateRuleField(index, 'matchType', value)}
                                    >
                                      <SelectTrigger className="h-10">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="contains">Contains</SelectItem>
                                        <SelectItem value="prefix">Prefix</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-sm text-muted-foreground mb-1 block">Match Value</Label>
                                    <Input
                                      value={rule.matchValue || ''}
                                      onChange={(e) => updateRuleField(index, 'matchValue', e.target.value)}
                                      placeholder="Slide/module id"
                                      className="h-10"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm text-muted-foreground mb-1 block">Completion Verbs</Label>
                                    <Input
                                      value={(rule.completionVerbs || []).join(', ')}
                                      onChange={(e) =>
                                        updateRuleField(
                                          index,
                                          'completionVerbs',
                                          e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                                        )
                                      }
                                      placeholder="verb1, verb2"
                                      className="h-10"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm text-muted-foreground mb-1 block">Score Threshold</Label>
                                    <Input
                                      type="number"
                                      value={rule.scoreThreshold ?? ''}
                                      onChange={(e) =>
                                        updateRuleField(
                                          index,
                                          'scoreThreshold',
                                          e.target.value === '' ? null : Number(e.target.value)
                                        )
                                      }
                                      placeholder="e.g., 80"
                                      className="h-10"
                                    />
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeModuleRule(index)}
                                  className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0 mt-6"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Statement Inspector Tab */}
                {activeTab === 'inspector' && (
                  <Card className="bg-muted/40 border-border">
                    <CardHeader className="pb-4">
                      <div>
                        <CardTitle className="text-xl font-semibold">Statement Inspector</CardTitle>
                        <CardDescription className="text-base">Inspect recent xAPI statements for debugging</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Controls */}
                      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-background rounded-lg border border-border">
                        <div className="flex-1">
                          <Label htmlFor="statementCourseSelect" className="text-base mb-2 block">Select Course</Label>
                          <Select value={statementCourseId} onValueChange={setStatementCourseId}>
                            <SelectTrigger id="statementCourseSelect" className="h-11">
                              <SelectValue placeholder="Choose a course..." />
                            </SelectTrigger>
                            <SelectContent>
                              {courses.map(course => (
                                <SelectItem key={course.courseId} value={course.courseId}>
                                  {course.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32">
                          <Label htmlFor="statementLimit" className="text-base mb-2 block">Limit</Label>
                          <Input
                            id="statementLimit"
                            type="number"
                            value={statementLimit}
                            onChange={(e) => setStatementLimit(e.target.value)}
                            className="h-11"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button onClick={loadStatements} disabled={!statementCourseId || statementsLoading} className="h-11">
                            <Eye className="h-4 w-4 mr-2" />
                            Load Statements
                          </Button>
                        </div>
                      </div>

                      {/* Results */}
                      {!statementCourseId ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Select a course and click "Load Statements"</p>
                        </div>
                      ) : statementsLoading ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                          <p>Loading statements...</p>
                        </div>
                      ) : statements.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">No statements found</p>
                          <p className="text-base">Click "Load Statements" to fetch data</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                                <TableHead className="text-base font-semibold text-foreground">Actor</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Verb</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Object</TableHead>
                                <TableHead className="text-base font-semibold text-foreground text-center">Score</TableHead>
                                <TableHead className="text-base font-semibold text-foreground text-center">Success</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {statements.map((statement, index) => (
                                <TableRow key={`${statement.id || index}`} className="hover:bg-muted/50 border-b border-border">
                                  <TableCell className="text-sm">
                                    {statement.actor?.name || statement.actor?.mbox?.replace('mailto:', '') || '—'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {statement.verb?.id?.split('/').pop() || '—'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm max-w-[200px] truncate" title={statement.object?.id}>
                                    {statement.object?.definition?.name?.['en-US'] || statement.object?.id?.split('/').pop() || '—'}
                                  </TableCell>
                                  <TableCell className="text-center text-base">
                                    {statement.result?.score?.scaled !== undefined
                                      ? `${Math.round(statement.result.score.scaled * 100)}%`
                                      : statement.result?.score?.raw ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {typeof statement.result?.success === 'boolean' ? (
                                      <Badge variant={statement.result.success ? "default" : "secondary"} 
                                        className={statement.result.success ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                                        {statement.result.success ? 'Yes' : 'No'}
                                      </Badge>
                                    ) : '—'}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {statement.timestamp ? new Date(statement.timestamp).toLocaleString() : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* KC Attempts Tab */}
                {activeTab === 'kc-attempts' && (
                  <Card className="bg-muted/40 border-border">
                    <CardHeader className="pb-4">
                      <div>
                        <CardTitle className="text-xl font-semibold">Knowledge Check Attempts</CardTitle>
                        <CardDescription className="text-base">Review quiz attempts by user</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-4 mb-6 p-4 bg-background rounded-lg border border-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div>
                          <Label htmlFor="kcUserEmail" className="text-base mb-2 block">User Email (optional)</Label>
                            <Input
                              id="kcUserEmail"
                              value={kcUserEmail}
                              onChange={(e) => setKcUserEmail(e.target.value)}
                              placeholder="user@company.com"
                              className="h-11"
                            />
                          </div>
                          <div>
                            <Label htmlFor="kcCourse" className="text-base mb-2 block">Course</Label>
                            <Select value={kcCourseId} onValueChange={setKcCourseId}>
                              <SelectTrigger id="kcCourse" className="h-11">
                                <SelectValue placeholder="All courses" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All courses</SelectItem>
                                {courses.map(course => (
                                  <SelectItem key={course.courseId} value={course.courseId}>
                                    {course.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="kcRegistration" className="text-base mb-2 block">Registration</Label>
                            <Input
                              id="kcRegistration"
                              value={kcRegistrationId}
                              onChange={(e) => setKcRegistrationId(e.target.value)}
                              placeholder="reg-123..."
                              className="h-11"
                            />
                          </div>
                          <div>
                            <Label htmlFor="kcAssessment" className="text-base mb-2 block">Assessment ID</Label>
                            <Input
                              id="kcAssessment"
                              value={kcAssessmentId}
                              onChange={(e) => setKcAssessmentId(e.target.value)}
                              placeholder="urn:kc:question"
                              className="h-11"
                            />
                          </div>
                          <div>
                            <Label htmlFor="kcLimit" className="text-base mb-2 block">Limit</Label>
                            <Input
                              id="kcLimit"
                              type="number"
                              value={kcLimit}
                              onChange={(e) => setKcLimit(e.target.value)}
                              className="h-11"
                            />
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            onClick={loadKcAttempts}
                            disabled={(!kcUserEmail && (!kcCourseId || kcCourseId === 'all')) || kcLoading}
                            className="h-11"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Load Attempts
                          </Button>
                        </div>
                      </div>

                      {!kcUserEmail && (!kcCourseId || kcCourseId === 'all') ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Enter a user email or select a course to load attempts</p>
                        </div>
                      ) : kcLoading ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                          <p>Loading attempts...</p>
                        </div>
                      ) : kcAttempts.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">No attempts found</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                                <TableHead className="text-base font-semibold text-foreground">User</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Course</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Assessment</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Verb</TableHead>
                                <TableHead className="text-base font-semibold text-foreground text-center">Score</TableHead>
                                <TableHead className="text-base font-semibold text-foreground text-center">Success</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Response</TableHead>
                                <TableHead className="text-base font-semibold text-foreground">Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {kcAttempts.map((attempt) => {
                                const courseTitle = attempt.courseId
                                  ? courses.find(course => course.courseId === attempt.courseId)?.title || attempt.courseId
                                  : '-';
                                const scoreDisplay = attempt.scoreScaled !== undefined && attempt.scoreScaled !== null
                                  ? `${Math.round(attempt.scoreScaled * 100)}%`
                                  : attempt.scoreRaw !== undefined && attempt.scoreRaw !== null
                                    ? (attempt.scoreMax
                                      ? `${attempt.scoreRaw}/${attempt.scoreMax}`
                                      : attempt.scoreRaw)
                                    : '-';

                                return (
                                  <TableRow key={attempt.attemptId} className="hover:bg-muted/50 border-b border-border">
                                    <TableCell className="text-sm">{attempt.userEmail}</TableCell>
                                    <TableCell className="text-sm max-w-[200px] truncate" title={courseTitle}>
                                      {courseTitle}
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[200px] truncate" title={attempt.assessmentId || ''}>
                                      {attempt.assessmentName || attempt.assessmentId || '-'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="font-mono text-xs">
                                        {attempt.verbId?.split('/').pop() || '-'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center text-base">{scoreDisplay}</TableCell>
                                    <TableCell className="text-center">
                                      {typeof attempt.success === 'boolean' ? (
                                        <Badge
                                          variant={attempt.success ? "default" : "secondary"}
                                          className={attempt.success ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}
                                        >
                                          {attempt.success ? 'Yes' : 'No'}
                                        </Badge>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[200px] truncate" title={attempt.response || ''}>
                                      {attempt.response || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {attempt.timestamp ? new Date(attempt.timestamp).toLocaleString() : (attempt.storedAt ? new Date(attempt.storedAt).toLocaleString() : '-')}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* KC Scores Tab */}
                {activeTab === 'kc-scores' && (
                  <Card className="bg-muted/40 border-border">
                    <CardHeader className="pb-4">
                      <div>
                        <CardTitle className="text-xl font-semibold">Knowledge Check Scores</CardTitle>
                        <CardDescription className="text-base">Review quiz score summaries by user or course</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-4 mb-6 p-4 bg-background rounded-lg border border-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div>
                            <Label htmlFor="kcScoresUserEmail" className="text-base mb-2 block">User Email (optional)</Label>
                            <Input
                              id="kcScoresUserEmail"
                              value={kcUserEmail}
                              onChange={(e) => setKcUserEmail(e.target.value)}
                              placeholder="user@company.com"
                              className="h-11"
                            />
                          </div>
                          <div>
                            <Label htmlFor="kcScoresCourse" className="text-base mb-2 block">Course</Label>
                            <Select value={kcCourseId} onValueChange={setKcCourseId}>
                              <SelectTrigger id="kcScoresCourse" className="h-11">
                                <SelectValue placeholder="All courses" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All courses</SelectItem>
                                {courses.map(course => (
                                  <SelectItem key={course.courseId} value={course.courseId}>
                                    {course.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="kcScoresRegistration" className="text-base mb-2 block">Registration</Label>
                            <Input
                              id="kcScoresRegistration"
                              value={kcRegistrationId}
                              onChange={(e) => setKcRegistrationId(e.target.value)}
                              placeholder="reg-123..."
                              className="h-11"
                            />
                          </div>
                          <div>
                            <Label htmlFor="kcScoresAssessment" className="text-base mb-2 block">Assessment ID</Label>
                            <Input
                              id="kcScoresAssessment"
                              value={kcAssessmentId}
                              onChange={(e) => setKcAssessmentId(e.target.value)}
                              placeholder="urn:kc:question"
                              className="h-11"
                            />
                          </div>
                          <div>
                            <Label htmlFor="kcScoresLimit" className="text-base mb-2 block">Limit</Label>
                            <Input
                              id="kcScoresLimit"
                              type="number"
                              value={kcLimit}
                              onChange={(e) => setKcLimit(e.target.value)}
                              className="h-11"
                            />
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            onClick={loadKcScores}
                            disabled={(!kcUserEmail && (!kcCourseId || kcCourseId === 'all')) || kcScoresLoading}
                            className="h-11"
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            Load Scores
                          </Button>
                        </div>
                      </div>

                      {kcScoresLoading ? (
                        <div className="text-center py-10 text-muted-foreground">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                          <p>Loading scores...</p>
                        </div>
                      ) : kcScores.length > 0 ? (
                        <div className="mb-8">
                          <h3 className="text-lg font-semibold mb-3">Score Summary</h3>
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                                  <TableHead className="text-base font-semibold text-foreground">Assessment</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Attempts</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Best</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Last</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Average</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Success</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground">Last Attempt</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {kcScores.map((score) => (
                                  <TableRow key={score.assessmentId} className="hover:bg-muted/50 border-b border-border">
                                    <TableCell className="text-sm max-w-[240px] truncate" title={score.assessmentId}>
                                      {score.assessmentName || score.assessmentId}
                                    </TableCell>
                                    <TableCell className="text-center text-base">{score.attempts}</TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.bestScorePercent !== null && score.bestScorePercent !== undefined
                                        ? `${score.bestScorePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.lastScorePercent !== null && score.lastScorePercent !== undefined
                                        ? `${score.lastScorePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.averageScorePercent !== null && score.averageScorePercent !== undefined
                                        ? `${score.averageScorePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.successRatePercent !== null && score.successRatePercent !== undefined
                                        ? `${score.successRatePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {score.lastAttemptAt ? new Date(score.lastAttemptAt).toLocaleString() : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : kcCourseScores.length > 0 ? (
                        <div className="mb-8">
                          <h3 className="text-lg font-semibold mb-3">Course Score Summary (All Users)</h3>
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                                  <TableHead className="text-base font-semibold text-foreground">User</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Attempts</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Best</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Last</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Average</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground text-center">Success</TableHead>
                                  <TableHead className="text-base font-semibold text-foreground">Last Attempt</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {kcCourseScores.map((score) => (
                                  <TableRow key={score.userEmail} className="hover:bg-muted/50 border-b border-border">
                                    <TableCell className="text-sm">{score.userEmail}</TableCell>
                                    <TableCell className="text-center text-base">{score.attempts}</TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.bestScorePercent !== null && score.bestScorePercent !== undefined
                                        ? `${score.bestScorePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.lastScorePercent !== null && score.lastScorePercent !== undefined
                                        ? `${score.lastScorePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.averageScorePercent !== null && score.averageScorePercent !== undefined
                                        ? `${score.averageScorePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-center text-base">
                                      {score.successRatePercent !== null && score.successRatePercent !== undefined
                                        ? `${score.successRatePercent}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {score.lastAttemptAt ? new Date(score.lastAttemptAt).toLocaleString() : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (!kcUserEmail && (!kcCourseId || kcCourseId === 'all')) ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Enter a user email or select a course to load scores</p>
                        </div>
                      ) : (
                        <div className="text-center py-16 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">No scores found</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Custom Verbs Tab */}
                {activeTab === 'custom-verbs' && (
                  <Card className="bg-muted/40 border-border">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl font-semibold">Custom Verb Configurations</CardTitle>
                          <CardDescription className="text-base">Manage custom xAPI verbs and their handlers</CardDescription>
                        </div>
                        <Button onClick={() => { setEditingVerb(null); setVerbForm({ verbId: '', category: 'interaction', action: 'track_interaction', description: '' }); setShowVerbDialog(true); }} className="h-11">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Custom Verb
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {customVerbs.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <Settings className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg mb-2">No custom verbs configured</p>
                          <p className="text-base">Click "Add Custom Verb" to create one</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {customVerbs.map((verb, index) => (
                            <motion.div
                              key={verb.verbId}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="p-4 bg-background rounded-lg border border-border hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-sm truncate text-foreground" title={verb.verbId}>
                                    {verb.verbId.split('/').pop() || verb.verbId}
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{verb.description || 'No description'}</p>
                                  <div className="flex gap-2 mt-3">
                                    <Badge variant="outline" className={
                                      verb.category === 'completion' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
                                      verb.category === 'progress' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                      'border-purple-300 text-purple-700 bg-purple-50'
                                    }>
                                      {verb.category}
                                    </Badge>
                                    <Badge variant="secondary">{verb.action}</Badge>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditVerb(verb.verbId)} className="h-8 w-8">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteVerb(verb.verbId)} className="h-8 w-8 hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Add/Edit Verb Dialog */}
      <Dialog open={showVerbDialog} onOpenChange={setShowVerbDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingVerb ? 'Edit Custom Verb' : 'Add Custom Verb'}</DialogTitle>
            <DialogDescription className="text-base">
              Configure a custom xAPI verb from the{' '}
              <a href="https://registry.tincanapi.com/#home/verbs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                xAPI Verb Registry
              </a>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editingVerb ? handleUpdateVerb : handleAddVerb} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="verbId" className="text-base">Verb ID</Label>
              <Input
                id="verbId"
                value={verbForm.verbId}
                onChange={(e) => setVerbForm({ ...verbForm, verbId: e.target.value })}
                placeholder="https://example.com/verbs/custom-action"
                required
                disabled={!!editingVerb}
                className="font-mono text-sm h-11 mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Full IRI of the verb from the registry
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-base">Category</Label>
                <Select value={verbForm.category} onValueChange={(value) => setVerbForm({ ...verbForm, category: value })}>
                  <SelectTrigger className="h-11 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completion">Completion</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="interaction">Interaction</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="action" className="text-base">Action</Label>
                <Select value={verbForm.action} onValueChange={(value) => setVerbForm({ ...verbForm, action: value })}>
                  <SelectTrigger className="h-11 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mark_completed">Mark Completed</SelectItem>
                    <SelectItem value="mark_passed">Mark Passed</SelectItem>
                    <SelectItem value="mark_failed">Mark Failed</SelectItem>
                    <SelectItem value="mark_started">Mark Started</SelectItem>
                    <SelectItem value="track_interaction">Track Interaction</SelectItem>
                    <SelectItem value="update_progress">Update Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description" className="text-base">Description</Label>
              <Textarea
                id="description"
                value={verbForm.description}
                onChange={(e) => setVerbForm({ ...verbForm, description: e.target.value })}
                placeholder="Describe what this verb represents..."
                required
                rows={3}
                className="mt-1"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => { setShowVerbDialog(false); setEditingVerb(null); }} className="h-11">
                Cancel
              </Button>
              <Button type="submit" className="h-11">
                {editingVerb ? 'Update Verb' : 'Add Verb'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
