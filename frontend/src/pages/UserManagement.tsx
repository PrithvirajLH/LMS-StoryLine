import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Users, Search, Shield, Trash2, UserPlus, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "../services/api";
import { getUser } from "../services/auth";

type RoleName =
  | 'learner'
  | 'admin'
  | 'manager'
  | 'coordinator'
  | 'learningCoordinator'
  | 'coach'
  | 'instructionalCoach'
  | 'corporate'
  | 'hr';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: RoleName;
  roles?: RoleName[];
  isAdmin?: boolean;
  isManager?: boolean;
  isCoordinator?: boolean;
  isLearningCoordinator?: boolean;
  isCoach?: boolean;
  isInstructionalCoach?: boolean;
  isCorporate?: boolean;
  isHr?: boolean;
  isLearner?: boolean;
  providerId?: string | null;
  createdAt?: string;
  lastLogin?: string;
}

interface Provider {
  providerId: string;
  name: string;
}

const primaryColor = '#881337';
const ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: 'learner', label: 'Learner' },
  { value: 'manager', label: 'Manager' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'learningCoordinator', label: 'Learning Coordinator' },
  { value: 'coach', label: 'Instructional Coach' },
  { value: 'instructionalCoach', label: 'Instructional Coach (alias)' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'hr', label: 'Corporate (HR alias)' },
  { value: 'admin', label: 'Admin' },
];

const ROLE_ALIASES: Record<string, RoleName[]> = {
  coach: ['instructionalCoach'],
  coordinator: ['learningCoordinator'],
  corporate: ['hr'],
};


export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [rolesDialogUser, setRolesDialogUser] = useState<User | null>(null);
  const [rolesDialogPrimary, setRolesDialogPrimary] = useState<RoleName>('learner');
  const [rolesDialogRoles, setRolesDialogRoles] = useState<RoleName[]>(['learner']);
  const [rolesDialogSaving, setRolesDialogSaving] = useState(false);
  const currentUser = getUser();

  const userHasRole = (user: User, role: RoleName) => {
    const roles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role];
    if (roles.includes(role)) return true;
    if (user.role === role) return true;
    const aliasList = ROLE_ALIASES[role] || [];
    if (aliasList.some((alias) => roles.includes(alias))) return true;
    const flagKey = `is${role.charAt(0).toUpperCase()}${role.slice(1)}`;
    if ((user as Record<string, boolean | undefined>)[flagKey] === true) return true;
    return false;
  };

  const adminCount = users.filter(u => userHasRole(u, 'admin')).length;
  const learnerCount = users.filter(u => userHasRole(u, 'learner')).length;

  const roleCounts = ROLE_OPTIONS.reduce<Record<string, number>>((acc, role) => {
    acc[role.value] = users.filter((user) => userHasRole(user, role.value)).length;
    return acc;
  }, { all: users.length });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersResponse, providersResponse] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/providers')
      ]);
      setUsers(usersResponse.data);
      setProviders(providersResponse.data || []);
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load users';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(query) ||
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query)
      );
    }
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => userHasRole(user, roleFilter as RoleName));
    }
    
    setFilteredUsers(filtered);
  };

  const handleRoleChange = async (userId: string, newRole: RoleName) => {
    try {
      await api.put(`/api/admin/users/${userId}/roles`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      loadUsers();
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update role';
      toast.error(errorMessage);
    }
  };

  const normalizeRoles = (user: User): RoleName[] => {
    const roles = Array.isArray(user.roles) && user.roles.length > 0 ? [...user.roles] : [user.role];
    if (!roles.includes(user.role)) roles.push(user.role);
    return Array.from(new Set(roles));
  };

  const openRolesDialog = (user: User) => {
    const roles = normalizeRoles(user);
    setRolesDialogUser(user);
    setRolesDialogPrimary(user.role || 'learner');
    setRolesDialogRoles(roles);
    setRolesDialogOpen(true);
  };

  const toggleRole = (role: RoleName) => {
    setRolesDialogRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      if (next.size === 0) {
        next.add('learner');
      }
      return Array.from(next);
    });
  };

  const handleRolesSave = async () => {
    if (!rolesDialogUser) return;
    setRolesDialogSaving(true);
    try {
      await api.put(`/api/admin/users/${rolesDialogUser.id}/roles`, {
        role: rolesDialogPrimary,
        roles: rolesDialogRoles,
      });
      toast.success('Roles updated');
      setRolesDialogOpen(false);
      setRolesDialogUser(null);
      loadUsers();
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update roles';
      toast.error(errorMessage);
    } finally {
      setRolesDialogSaving(false);
    }
  };

  const handleProviderChange = async (userId: string, providerId: string | null) => {
    try {
      await api.put(`/api/admin/users/${userId}/provider`, { providerId });
      toast.success('Provider updated');
      loadUsers();
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update provider';
      toast.error(errorMessage);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      await api.delete(`/api/admin/users/${userToDelete.id}`);
      toast.success('User deleted');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete user';
      toast.error(errorMessage);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    return user.email.split('@')[0];
  };

  const providerNameById = (providerId?: string | null) => {
    if (!providerId) return 'Unassigned';
    return providers.find(p => p.providerId === providerId)?.name || 'Unknown';
  };

  return (
    <>
      <Helmet>
        <title>User Management | LMS Admin</title>
      </Helmet>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-b border-border bg-card/50 backdrop-blur-sm"
        >
          <div className="macro-padding py-8">
            <h1 className="text-5xl lg:text-6xl font-serif font-bold text-foreground tracking-tight mb-2">
              User Management
            </h1>
            <p className="text-muted-foreground text-lg font-serif">
              Manage user accounts and permissions
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

            {/* Search & Filter Bar */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.1 }}
              className="flex items-center gap-4 flex-wrap mb-6"
            >
              <div className="relative flex-1 min-w-[250px] max-w-[400px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              
              {/* Role Filter */}
              <div className="flex items-center gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[220px] h-11">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({users.length})</SelectItem>
                    <SelectItem value="admin">Admins ({adminCount})</SelectItem>
                    <SelectItem value="learner">Learners ({learnerCount})</SelectItem>
                    {ROLE_OPTIONS.filter(r => !['admin', 'learner'].includes(r.value)).map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label} ({roleCounts[role.value] || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {searchQuery && (
                <Button
                  variant="ghost"
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </motion.div>

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg">Loading users...</p>
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm">
                  <CardContent className="p-12 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <UserPlus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-lg mb-2">
                      {searchQuery ? 'No users found' : 'No users yet'}
                    </p>
                    <p className="text-muted-foreground">
                      {searchQuery 
                        ? 'Try a different search term' 
                        : 'Users will appear here once they register'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="bg-muted/40 border-border shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5" style={{ color: primaryColor }} />
                      Users ({filteredUsers.length})
                    </CardTitle>
                    <CardDescription>
                      Manage user accounts, roles, and permissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-muted/50">
                          <TableHead className="font-semibold text-foreground">User</TableHead>
                          <TableHead className="font-semibold text-foreground">Primary Role</TableHead>
                          <TableHead className="font-semibold text-foreground">Roles & Flags</TableHead>
                          <TableHead className="font-semibold text-foreground">Provider</TableHead>
                          <TableHead className="font-semibold text-foreground">Created</TableHead>
                          <TableHead className="font-semibold text-foreground">Last Login</TableHead>
                          <TableHead className="font-semibold text-foreground w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user, idx) => {
                          const isCurrentUser = user.email === currentUser?.email;
                          return (
                            <motion.tr
                              key={user.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="hover:bg-muted/50 transition-colors border-b border-border group"
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback 
                                      className="font-medium" 
                                      style={{ 
                                        backgroundColor: isCurrentUser ? primaryColor : `${primaryColor}15`, 
                                        color: isCurrentUser ? 'white' : primaryColor 
                                      }}
                                    >
                                      {getInitials(user)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{getDisplayName(user)}</span>
                                      {isCurrentUser && (
                                        <Badge variant="outline" className="font-normal">
                                          You
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-sm text-muted-foreground">{user.email}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {isCurrentUser ? (
                                  <Badge 
                                    className="border-0"
                                    style={{ 
                                      backgroundColor: user.role === 'admin' ? `${primaryColor}15` : '#f0f9ff',
                                      color: user.role === 'admin' ? primaryColor : '#0369a1'
                                    }}
                                  >
                                    {user.role === 'admin' && <Shield className="h-3.5 w-3.5 mr-1" />}
                                    {ROLE_OPTIONS.find(role => role.value === user.role)?.label || user.role}
                                  </Badge>
                                ) : (
                                  <Select
                                    value={user.role}
                                    onValueChange={(value: RoleName) => handleRoleChange(user.id, value)}
                                  >
                                    <SelectTrigger className="w-[180px] h-9 border-dashed">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ROLE_OPTIONS.map((role) => (
                                        <SelectItem key={role.value} value={role.value}>
                                          <div className="flex items-center gap-2">
                                            {role.value === 'admin' && <Shield className="h-4 w-4" />}
                                            {role.value === 'learner' && <Users className="h-4 w-4" />}
                                            {role.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-wrap gap-1">
                                    {normalizeRoles(user).map((role) => (
                                      <Badge key={`${user.id}-${role}`} variant="secondary" className="text-xs">
                                        {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                                      </Badge>
                                    ))}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="self-start px-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => openRolesDialog(user)}
                                  >
                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                    Edit roles
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={user.providerId || 'unassigned'}
                                  onValueChange={(value: string) =>
                                    handleProviderChange(user.id, value === 'unassigned' ? null : value)
                                  }
                                >
                                  <SelectTrigger className="w-[180px] h-9 border-dashed">
                                    <SelectValue placeholder="Select provider">
                                      {providerNameById(user.providerId)}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {providers.map(provider => (
                                      <SelectItem key={provider.providerId} value={provider.providerId}>
                                        {provider.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(user.createdAt)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(user.lastLogin)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={isCurrentUser}
                                  title={isCurrentUser ? "Can't delete yourself" : "Delete user"}
                                >
                                  <Trash2 className="h-5 w-5" />
                                </Button>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Delete User</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Delete <strong>{userToDelete?.email}</strong>? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Roles & Flags Dialog */}
        <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Roles</DialogTitle>
              <DialogDescription>
                Update primary role, role membership, and flags for {rolesDialogUser?.email}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="primary-role">Primary role</Label>
                <Select
                  value={rolesDialogPrimary}
                  onValueChange={(value: RoleName) => setRolesDialogPrimary(value)}
                >
                  <SelectTrigger id="primary-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                <Label>Roles</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((role) => (
                    <label key={`role-${role.value}`} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={rolesDialogRoles.includes(role.value)}
                        onCheckedChange={() => toggleRole(role.value)}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">
                  Roles are stored as a list. The primary role is used for default routing and display.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setRolesDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRolesSave} disabled={rolesDialogSaving}>
                {rolesDialogSaving ? 'Saving...' : 'Save roles'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
