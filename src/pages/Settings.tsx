
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings as SettingsIcon, Plus, Edit, Trash2, Save } from 'lucide-react';

interface ConfigItem {
  id: string;
  name: string;
  description?: string;
  url?: string;
  category?: string;
  is_active: boolean;
}

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('program-types');
  const [editModal, setEditModal] = useState<{ isOpen: boolean; type: string; item?: ConfigItem }>({ isOpen: false, type: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; item?: ConfigItem }>({ isOpen: false });
  const [formData, setFormData] = useState({ name: '', description: '', url: '', category: '' });

  // Fetch configuration data
  const { data: programTypes = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ['program-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('program_types').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: platforms = [], isLoading: loadingPlatforms } = useQuery({
    queryKey: ['certification-platforms'],
    queryFn: async () => {
      const { data, error } = await supabase.from('certification_platforms').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: domains = [], isLoading: loadingDomains } = useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const { data, error } = await supabase.from('domains').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Mutations for CRUD operations
  const createMutation = useMutation({
    mutationFn: async ({ table, data }: { table: string; data: any }) => {
      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;
    },
    onSuccess: (_, { table }) => {
      queryClient.invalidateQueries({ queryKey: [table.replace('_', '-')] });
      toast({ title: "Success", description: "Item created successfully" });
      setEditModal({ isOpen: false, type: '' });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ table, id, data }: { table: string; id: string; data: any }) => {
      const { error } = await supabase.from(table).update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { table }) => {
      queryClient.invalidateQueries({ queryKey: [table.replace('_', '-')] });
      toast({ title: "Success", description: "Item updated successfully" });
      setEditModal({ isOpen: false, type: '' });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { table }) => {
      queryClient.invalidateQueries({ queryKey: [table.replace('_', '-')] });
      toast({ title: "Success", description: "Item deleted successfully" });
      setDeleteDialog({ isOpen: false });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAdd = (type: string) => {
    setFormData({ name: '', description: '', url: '', category: '' });
    setEditModal({ isOpen: true, type });
  };

  const handleEdit = (type: string, item: ConfigItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      url: item.url || '',
      category: item.category || ''
    });
    setEditModal({ isOpen: true, type, item });
  };

  const handleSave = () => {
    const table = editModal.type.replace('-', '_');
    const data = { name: formData.name };
    
    if (editModal.type === 'program-types') {
      Object.assign(data, { description: formData.description });
    } else if (editModal.type === 'certification-platforms') {
      Object.assign(data, { url: formData.url });
    } else if (editModal.type === 'domains') {
      Object.assign(data, { category: formData.category });
    }

    if (editModal.item) {
      updateMutation.mutate({ table, id: editModal.item.id, data });
    } else {
      createMutation.mutate({ table, data });
    }
  };

  const handleDelete = (item: ConfigItem) => {
    setDeleteDialog({ isOpen: true, item });
  };

  const confirmDelete = () => {
    if (deleteDialog.item) {
      const table = activeTab.replace('-', '_');
      deleteMutation.mutate({ table, id: deleteDialog.item.id });
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to view this page.</p>
      </div>
    );
  }

  const renderConfigSection = (title: string, data: ConfigItem[], isLoading: boolean, type: string) => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon size={20} />
            {title}
          </CardTitle>
          <Button onClick={() => handleAdd(type)} className="flex items-center gap-2">
            <Plus size={16} />
            Add New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No items found</div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{item.name}</h4>
                    <Badge variant={item.is_active ? "default" : "secondary"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  )}
                  {item.url && (
                    <p className="text-sm text-blue-600 mt-1">{item.url}</p>
                  )}
                  {item.category && (
                    <p className="text-sm text-gray-500 mt-1">Category: {item.category}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(type, item)}>
                    <Edit size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(item)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon size={32} className="text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground">Manage system configuration and dynamic dropdowns</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="program-types">Program Types</TabsTrigger>
          <TabsTrigger value="certification-platforms">Platforms</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
        </TabsList>

        <TabsContent value="program-types" className="space-y-4">
          {renderConfigSection("Program Types", programTypes, loadingPrograms, "program-types")}
        </TabsContent>

        <TabsContent value="certification-platforms" className="space-y-4">
          {renderConfigSection("Certification Platforms", platforms, loadingPlatforms, "certification-platforms")}
        </TabsContent>

        <TabsContent value="domains" className="space-y-4">
          {renderConfigSection("Domains", domains, loadingDomains, "domains")}
        </TabsContent>
      </Tabs>

      {/* Edit/Create Modal */}
      <Dialog open={editModal.isOpen} onOpenChange={(open) => setEditModal({ isOpen: open, type: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editModal.item ? 'Edit' : 'Create'} {editModal.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
              />
            </div>
            
            {editModal.type === 'program-types' && (
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                />
              </div>
            )}

            {editModal.type === 'certification-platforms' && (
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="Enter URL (optional)"
                />
              </div>
            )}

            {editModal.type === 'domains' && (
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Enter category"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditModal({ isOpen: false, type: '' })}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.name}>
                <Save size={16} className="mr-2" />
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => setDeleteDialog({ isOpen: open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteDialog.item?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
