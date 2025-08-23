
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, X } from 'lucide-react';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  editUser?: any;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, editUser }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: editUser?.name || '',
    email: editUser?.email || '',
    employee_id: editUser?.employee_id || '',
    role: editUser?.role || 'faculty',
    department_id: editUser?.department_id || '',
    designation: editUser?.designation || '',
    institution: editUser?.institution || 'NMIT',
    password: '', // Only used for new users
  });
  const [showPassword, setShowPassword] = useState<string | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      if (editUser) {
        // Update existing user (do not update password or auth_user_id)
        const { error } = await supabase
          .from('users')
          .update({
            name: userData.name,
            email: userData.email,
            employee_id: userData.employee_id,
            role: userData.role,
            department_id: userData.department_id,
            designation: userData.designation,
            institution: userData.institution,
          })
          .eq('id', editUser.id);
        if (error) throw error;
      } else {
        // Create new user using Edge Function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            name: userData.name,
            email: userData.email,
            employee_id: userData.employee_id,
            role: userData.role,
            department_id: userData.department_id,
            designation: userData.designation,
            institution: userData.institution,
            password: userData.password,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setShowPassword(userData.password);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast({
        title: editUser ? 'User Updated' : 'User Created Successfully',
        description: editUser
          ? 'User has been updated successfully.'
          : 'User has been created and login credentials have been sent via email.',
        duration: 5000,
      });
      setShowPassword(null);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  React.useEffect(() => {
    if (editUser) {
      setFormData({
        name: editUser.name || '',
        email: editUser.email || '',
        employee_id: editUser.employee_id || '',
        role: editUser.role || 'faculty',
        department_id: editUser.department_id || '',
        designation: editUser.designation || '',
        institution: editUser.institution || 'NMIT',
        password: '', // Always blank for edit
      });
    } else {
      setFormData({
        name: '',
        email: '',
        employee_id: '',
        role: 'faculty',
        department_id: '',
        designation: '',
        institution: 'NMIT',
        password: '',
      });
    }
  }, [editUser, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editUser ? 'Edit User' : 'Create New User'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                value={formData.employee_id}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>
          {/* Password field only for new users */}
          {!editUser && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="hod">Head of Department</SelectItem>
                  <SelectItem value="admin">Faculty Development Cell</SelectItem>
                  <SelectItem value="accounts">Accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={formData.department_id} onValueChange={(value) => handleInputChange('department_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              value={formData.designation}
              onChange={(e) => handleInputChange('designation', e.target.value)}
              placeholder="e.g., Assistant Professor"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              <X size={16} className="mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending}>
              <Save size={16} className="mr-2" />
              {createUserMutation.isPending ? 'Saving...' : (editUser ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
