import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, Edit, Trash2, Activity } from "lucide-react";
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

export default function AdminPanel() {
  const [verbStats, setVerbStats] = useState<any>({});
  const [verbConfigs, setVerbConfigs] = useState<any>({ standard: {}, custom: {} });
  const [customVerbs, setCustomVerbs] = useState<any[]>([]);
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
  }, []);

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

      <div className="min-h-screen bg-background">
        <div className="pt-24 pb-16">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">xAPI Verb Tracking</h1>
              <p className="text-muted-foreground">
                Monitor and manage xAPI verbs from the <a href="https://registry.tincanapi.com/#home/verbs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">xAPI Verb Registry</a>
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div></div>
              <Button onClick={() => {
                setShowVerbForm(true);
                setEditingVerb(null);
                setVerbForm({
                  verbId: '',
                  category: 'interaction',
                  action: 'track_interaction',
                  description: '',
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Verb
              </Button>
            </div>

            {/* Statistics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Verbs Tracked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Object.keys(verbStats).length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {verbConfigs.standard ? Object.keys(verbConfigs.standard).length : 0} standard, {customVerbs.length} custom
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Statements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.values(verbStats).reduce((sum: number, stat: any) => sum + (stat.totalCount || 0), 0) as number}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">All verb statements tracked</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(Object.values(verbStats).flatMap((stat: any) => stat.users || [])).size as number}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Users who sent statements</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Verb Statistics</CardTitle>
                <CardDescription>View all tracked xAPI verbs and their usage statistics</CardDescription>
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
                      ) : Object.entries(verbStats)
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
                        })}
                      {!loading && Object.keys(verbStats).length === 0 && (
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
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Custom Verb Configurations</CardTitle>
                <CardDescription>Manage custom xAPI verbs and their handlers</CardDescription>
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

            {/* Add/Edit Verb Form */}
            {showVerbForm && (
              <Card>
                <CardHeader>
                  <CardTitle>{editingVerb ? 'Edit Custom Verb' : 'Add Custom Verb'}</CardTitle>
                  <CardDescription>
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}
