import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Plus, Edit, Trash2, Activity, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function AdminPanel() {
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
  const [showVerbForm, setShowVerbForm] = useState(false);
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

  useEffect(() => {
    loadVerbs();
    loadCourses();
  }, []);

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

  const loadVerbs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/admin/verbs');
      setVerbStats(response.data.statistics || {});
      setVerbConfigs(response.data.verbConfigs || { standard: {}, custom: {} });
      
      // Extract custom verbs
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
    toast.info('New module rule added. Fill in the details and click Save Rules.');
  };

  const removeModuleRule = (index: number) => {
    setModuleRules(prev => prev.filter((_, i) => i !== index));
    setModuleRulesDirty(true);
    toast.info('Module rule removed. Click Save Rules to persist changes.');
  };

  const handleModuleCourseChange = (courseId: string) => {
    if (moduleRulesDirty) {
      const confirmDiscard = window.confirm('You have unsaved module rule changes. Discard and switch courses?');
      if (!confirmDiscard) {
        return;
      }
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
      toast.success('Custom verb added successfully');
      setShowVerbForm(false);
      setVerbForm({
        verbId: '',
        category: 'interaction',
        action: 'track_interaction',
        description: '',
      });
      loadVerbs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add custom verb');
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
      setShowVerbForm(true);
    }
  };

  const handleUpdateVerb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVerb) return;
    try {
      setError('');
      await api.put(`/api/admin/verbs/${encodeURIComponent(editingVerb)}`, {
        config: {
          category: verbForm.category,
          action: verbForm.action,
          description: verbForm.description,
        }
      });
      toast.success('Custom verb updated successfully');
      setShowVerbForm(false);
      setEditingVerb(null);
      setVerbForm({
        verbId: '',
        category: 'interaction',
        action: 'track_interaction',
        description: '',
      });
      loadVerbs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update custom verb');
      toast.error(err.response?.data?.error || 'Failed to update custom verb');
    }
  };

  const handleDeleteVerb = async (verbId: string) => {
    if (!confirm(`Are you sure you want to delete the custom verb "${verbId}"?`)) {
      return;
    }
    try {
      setError('');
      await api.delete(`/api/admin/verbs/${encodeURIComponent(verbId)}`);
      toast.success('Custom verb deleted successfully');
      loadVerbs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete custom verb');
      toast.error(err.response?.data?.error || 'Failed to delete custom verb');
    }
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
        <title>xAPI Verbs | Creative Learning</title>
        <meta name="description" content="Monitor and manage xAPI verbs from the xAPI Verb Registry" />
      </Helmet>

      <div className="flex flex-col h-full bg-background">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="px-8 py-8">
            <div className="mb-6">
              <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-4 flex items-center gap-3">
                <div 
                  className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)'
                  }}
                >
                  <Activity className="h-6 w-6 text-white" />
                </div>
                xAPI Verb Tracking
              </h1>
              <p className="text-muted-foreground text-lg font-serif">
                Monitor and manage xAPI verbs from the <a href="https://registry.tincanapi.com/#home/verbs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">xAPI Verb Registry</a>
              </p>
            </div>
          </div>
        </motion.header>

        <div className="flex-1 overflow-y-auto">
          <div className="macro-padding pb-24">

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20 text-lg font-serif">
                {error}
              </div>
            )}

            {/* Statistics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-serif">Total Verbs</p>
                        <p className="text-4xl font-serif font-bold text-foreground">
                          {(verbConfigs.standard ? Object.keys(verbConfigs.standard).length : 0) + customVerbs.length}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 font-serif">
                          {verbConfigs.standard ? Object.keys(verbConfigs.standard).length : 0} standard, {customVerbs.length} custom
                        </p>
                      </div>
                      <div 
                        className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #667eea, #764ba2)'
                        }}
                      >
                        <Activity className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-serif">Total Statements</p>
                        <p className="text-4xl font-serif font-bold text-foreground">
                          {Object.values(verbStats).reduce((sum: number, stat: any) => sum + (stat.totalCount || 0), 0) as number}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 font-serif">All verb statements tracked</p>
                      </div>
                      <div 
                        className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #4ECDC4, #44A08D)'
                        }}
                      >
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm hover:shadow-md transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-serif">Unique Users</p>
                        <p className="text-4xl font-serif font-bold text-foreground">
                          {new Set(Object.values(verbStats).flatMap((stat: any) => stat.users || [])).size as number}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 font-serif">Users who sent statements</p>
                      </div>
                      <div 
                        className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #FF6B9D, #C44569)'
                        }}
                      >
                        <Users className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Filters */}
            <Card className="mb-8 bg-muted/40 border-border">
              <CardHeader>
                <CardTitle className="text-xl font-serif font-semibold">Verb Statistics</CardTitle>
                <CardDescription className="font-serif">View all tracked xAPI verbs and their usage statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by verb ID..."
                      value={verbSearchQuery}
                      onChange={(e) => setVerbSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <Select value={verbCategoryFilter} onValueChange={setVerbCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by category" />
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

                <div className="border-2 border-black rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-black text-white">
                        <TableHead className="text-white">Verb ID</TableHead>
                        <TableHead className="text-white">Category</TableHead>
                        <TableHead className="text-white">Total Count</TableHead>
                        <TableHead className="text-white">Unique Users</TableHead>
                        <TableHead className="text-white">Unique Activities</TableHead>
                        <TableHead className="text-white">Last Used</TableHead>
                        <TableHead className="text-white">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Loading verb statistics...
                          </TableCell>
                        </TableRow>
                      ) : (() => {
                        // Merge all configured verbs with statistics
                        // Start with all configured verbs (standard + custom)
                        const allVerbs = new Map<string, any>();
                        
                        // Add all standard verbs
                        if (verbConfigs.standard) {
                          Object.keys(verbConfigs.standard).forEach(verbId => {
                            allVerbs.set(verbId, {
                              verbId,
                              totalCount: 0,
                              uniqueUsers: 0,
                              uniqueActivities: 0,
                              lastUsed: null,
                              ...verbStats[verbId] // Merge with stats if available
                            });
                          });
                        }
                        
                        // Add all custom verbs
                        if (verbConfigs.custom) {
                          Object.keys(verbConfigs.custom).forEach(verbId => {
                            allVerbs.set(verbId, {
                              verbId,
                              totalCount: 0,
                              uniqueUsers: 0,
                              uniqueActivities: 0,
                              lastUsed: null,
                              ...verbStats[verbId] // Merge with stats if available
                            });
                          });
                        }
                        
                        // Also include any verbs in stats that aren't configured (unknown verbs)
                        Object.keys(verbStats).forEach(verbId => {
                          if (!allVerbs.has(verbId)) {
                            allVerbs.set(verbId, verbStats[verbId]);
                          }
                        });
                        
                        const verbsArray = Array.from(allVerbs.entries());
                        
                        return verbsArray
                          .filter(([verbId]) => {
                            if (verbSearchQuery && !verbId.toLowerCase().includes(verbSearchQuery.toLowerCase())) {
                              return false;
                            }
                            if (verbCategoryFilter !== 'all') {
                              const config = verbConfigs.standard?.[verbId] || verbConfigs.custom?.[verbId];
                              if (!config || config.category !== verbCategoryFilter) {
                                return false;
                              }
                            }
                            return true;
                          })
                          .sort(([, a]: [string, any], [, b]: [string, any]) => (b.totalCount || 0) - (a.totalCount || 0))
                          .map(([verbId, stat]: [string, any]) => {
                            const config = verbConfigs.standard?.[verbId] || verbConfigs.custom?.[verbId];
                            const isCustom = !!verbConfigs.custom?.[verbId];
                            const category = config?.category || 'unknown';
                            return (
                              <TableRow key={verbId}>
                                <TableCell className="font-mono text-xs max-w-md truncate" title={verbId}>
                                  {verbId}
                                </TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    category === 'completion' ? 'bg-green-100 text-green-800' :
                                    category === 'progress' ? 'bg-blue-100 text-blue-800' :
                                    category === 'interaction' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {category}
                                  </span>
                                </TableCell>
                                <TableCell className="font-medium">{stat.totalCount || 0}</TableCell>
                                <TableCell>{stat.uniqueUsers || 0}</TableCell>
                                <TableCell>{stat.uniqueActivities || 0}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {stat.lastUsed ? new Date(stat.lastUsed).toLocaleDateString() : 'Never'}
                                </TableCell>
                                <TableCell>
                                  {isCustom ? (
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                      Custom
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                      Standard
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          });
                      })()}
                      {!loading && (() => {
                        const allVerbs = new Set([
                          ...Object.keys(verbConfigs.standard || {}),
                          ...Object.keys(verbConfigs.custom || {}),
                          ...Object.keys(verbStats)
                        ]);
                        return allVerbs.size === 0;
                      })() && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No verb statistics available. Verbs will appear here as courses send xAPI statements.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Custom Verbs Management */}
            <Card className="mb-8 bg-muted/40 border-border">
              <CardHeader>
                <CardTitle className="text-xl font-serif font-semibold">Custom Verb Configurations</CardTitle>
                <CardDescription className="font-serif">Manage custom xAPI verbs and their handlers</CardDescription>
              </CardHeader>
              <CardContent>
                {customVerbs.length > 0 ? (
                  <div className="space-y-2">
                    {customVerbs.map((verb) => (
                      <div key={verb.verbId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm font-mono">{verb.verbId}</div>
                          <div className="text-sm text-muted-foreground mt-1">{verb.description}</div>
                          <div className="flex gap-2 mt-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              verb.category === 'completion' ? 'bg-green-100 text-green-800' :
                              verb.category === 'progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {verb.category}
                            </span>
                            <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                              {verb.action}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditVerb(verb.verbId)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteVerb(verb.verbId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No custom verbs configured. Click "Add Custom Verb" to create one.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Course Module Rules */}
            <Card className="mb-8 bg-muted/40 border-border">
              <CardHeader>
                <CardTitle className="text-xl font-serif font-semibold">Course Module Rules</CardTitle>
                <CardDescription className="font-serif">Map Storyline modules to completion verbs and score rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <Label htmlFor="courseSelect">Select Course</Label>
                    <Select value={moduleCourseId} onValueChange={handleModuleCourseChange}>
                      <SelectTrigger id="courseSelect">
                        <SelectValue placeholder="Choose a course" />
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
                  <div className="flex items-end gap-3">
                    {moduleRulesDirty && (
                      <span className="text-sm text-muted-foreground">Unsaved changes</span>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={addModuleRule} 
                      disabled={!moduleCourseId || moduleRulesLoading}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                    <Button onClick={saveModuleRules} disabled={!moduleCourseId || moduleRulesLoading}>
                      Save Rules
                    </Button>
                  </div>
                </div>

                {!moduleCourseId && (
                  <div className="text-sm text-muted-foreground">Select a course to edit module rules.</div>
                )}

                {moduleCourseId && (
                  <div className="border-2 border-black rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-black text-white">
                          <TableHead className="text-white">Module</TableHead>
                          <TableHead className="text-white">Match</TableHead>
                          <TableHead className="text-white">Match Value</TableHead>
                          <TableHead className="text-white">Completion Verbs (comma-separated)</TableHead>
                          <TableHead className="text-white">Score Threshold</TableHead>
                          <TableHead className="text-white w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {moduleRulesLoading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                              Loading module rules...
                            </TableCell>
                          </TableRow>
                        ) : moduleRules.map((rule, index) => (
                          <TableRow key={`${rule.moduleId}-${index}`}>
                            <TableCell className="font-medium">
                              <Input
                                value={rule.moduleName || rule.moduleId}
                                onChange={(e) => updateRuleField(index, 'moduleName', e.target.value)}
                                placeholder="Module name"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={rule.matchType || 'contains'}
                                onValueChange={(value) => updateRuleField(index, 'matchType', value)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="contains">Contains</SelectItem>
                                  <SelectItem value="prefix">Prefix</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={rule.matchValue || ''}
                                onChange={(e) => updateRuleField(index, 'matchValue', e.target.value)}
                                placeholder="Slide/module id"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={(rule.completionVerbs || []).join(',')}
                                onChange={(e) =>
                                  updateRuleField(
                                    index,
                                    'completionVerbs',
                                    e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                                  )
                                }
                                placeholder="verb1, verb2"
                              />
                            </TableCell>
                            <TableCell>
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
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => removeModuleRule(index)}
                                title="Delete rule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!moduleRulesLoading && moduleRules.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                              No module rules configured for this course. Click "Add Rule" to create one.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statement Inspector */}
            <Card className="mb-8 bg-muted/40 border-border">
              <CardHeader>
                <CardTitle className="text-xl font-serif font-semibold">Statement Inspector</CardTitle>
                <CardDescription className="font-serif">Inspect recent xAPI statements for a course</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <Label htmlFor="statementCourseSelect">Select Course</Label>
                    <Select value={statementCourseId} onValueChange={setStatementCourseId}>
                      <SelectTrigger id="statementCourseSelect">
                        <SelectValue placeholder="Choose a course" />
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
                  <div>
                    <Label htmlFor="statementLimit">Limit</Label>
                    <Input
                      id="statementLimit"
                      type="number"
                      value={statementLimit}
                      onChange={(e) => setStatementLimit(e.target.value)}
                      className="w-[120px]"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadStatements} disabled={!statementCourseId || statementsLoading}>
                      Load Statements
                    </Button>
                  </div>
                </div>

                <div className="border-2 border-black rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-black text-white">
                        <TableHead className="text-white">Actor</TableHead>
                        <TableHead className="text-white">Verb</TableHead>
                        <TableHead className="text-white">Object</TableHead>
                        <TableHead className="text-white">Score</TableHead>
                        <TableHead className="text-white">Success</TableHead>
                        <TableHead className="text-white">Registration</TableHead>
                        <TableHead className="text-white">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statementsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                            Loading statements...
                          </TableCell>
                        </TableRow>
                      ) : statements.map((statement, index) => (
                        <TableRow key={`${statement.id || index}`}>
                          <TableCell className="text-xs font-mono">
                            {statement.actor?.mbox || statement.actor?.name || '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{statement.verb?.id || '—'}</TableCell>
                          <TableCell className="text-xs font-mono max-w-sm truncate" title={statement.object?.id}>
                            {statement.object?.id || '—'}
                          </TableCell>
                          <TableCell>
                            {statement.result?.score?.scaled !== undefined
                              ? Math.round(statement.result.score.scaled * 100)
                              : statement.result?.score?.raw ?? '—'}
                          </TableCell>
                          <TableCell>
                            {typeof statement.result?.success === 'boolean'
                              ? (statement.result.success ? 'Yes' : 'No')
                              : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {statement.context?.registration || '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {statement.timestamp ? new Date(statement.timestamp).toLocaleString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!statementsLoading && statements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                            No statements loaded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Add/Edit Verb Form */}
            {showVerbForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="bg-muted/40 border-border">
                  <CardHeader>
                    <CardTitle className="text-xl font-serif font-semibold">{editingVerb ? 'Edit Custom Verb' : 'Add Custom Verb'}</CardTitle>
                    <CardDescription className="font-serif">
                      Configure a custom xAPI verb from the <a href="https://registry.tincanapi.com/#home/verbs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">xAPI Verb Registry</a>
                    </CardDescription>
                  </CardHeader>
                <CardContent>
                  <form onSubmit={editingVerb ? handleUpdateVerb : handleAddVerb} className="space-y-4">
                    <div>
                      <Label htmlFor="verbId">Verb ID</Label>
                      <Input
                        id="verbId"
                        value={verbForm.verbId}
                        onChange={(e) => setVerbForm({ ...verbForm, verbId: e.target.value })}
                        placeholder="https://example.com/verbs/custom-action"
                        required
                        disabled={!!editingVerb}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Full IRI of the verb from the xAPI Verb Registry
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={verbForm.category}
                        onValueChange={(value) => setVerbForm({ ...verbForm, category: value })}
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="action">Action</Label>
                      <Select
                        value={verbForm.action}
                        onValueChange={(value) => setVerbForm({ ...verbForm, action: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mark_completed">Mark Completed</SelectItem>
                          <SelectItem value="mark_passed">Mark Passed</SelectItem>
                          <SelectItem value="mark_failed">Mark Failed</SelectItem>
                          <SelectItem value="mark_started">Mark Started</SelectItem>
                          <SelectItem value="track_interaction">Track Interaction</SelectItem>
                          <SelectItem value="track_download">Track Download</SelectItem>
                          <SelectItem value="track_share">Track Share</SelectItem>
                          <SelectItem value="track_bookmark">Track Bookmark</SelectItem>
                          <SelectItem value="update_progress">Update Progress</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={verbForm.description}
                        onChange={(e) => setVerbForm({ ...verbForm, description: e.target.value })}
                        placeholder="Describe what this verb represents..."
                        required
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">
                        {editingVerb ? 'Update Verb' : 'Add Verb'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowVerbForm(false);
                          setEditingVerb(null);
                          setVerbForm({
                            verbId: '',
                            category: 'interaction',
                            action: 'track_interaction',
                            description: '',
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
