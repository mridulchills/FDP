import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User, LoginCredentials } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  signup: (credentials: LoginCredentials & { name: string; designation: string; departmentId: string }) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        
        if (session?.user) {
          // Fetch user profile from our users table
          setTimeout(async () => {
            try {
              const { data: userProfile, error } = await supabase
                .from('users')
                .select(`
                  *,
                  department:departments!users_department_id_fkey(name)
                `)
                .eq('auth_user_id', session.user.id)
                .single();

              if (error && error.code !== 'PGRST116') {
                console.error('Error fetching user profile:', error);
                toast({
                  title: "Error",
                  description: "Failed to load user profile",
                  variant: "destructive"
                });
                return;
              }

              if (userProfile) {
                const mappedUser: User = {
                  id: userProfile.id,
                  employeeId: userProfile.employee_id,
                  name: userProfile.name,
                  email: userProfile.email,
                  role: userProfile.role as 'faculty' | 'hod' | 'admin',
                  department: userProfile.department?.name || 'Unknown',
                  designation: userProfile.designation,
                  institution: userProfile.institution,
                  createdAt: userProfile.created_at,
                  updatedAt: userProfile.updated_at
                };
                setUser(mappedUser);
              }
            } catch (error) {
              console.error('Error in auth state change:', error);
            }
          }, 0);
        } else {
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session);
      // Auth state change handler will handle the rest
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.employeeId.includes('@') ? credentials.employeeId : `${credentials.employeeId}@nmit.ac.in`,
        password: credentials.password,
      });

      if (error) {
        console.error('Login error:', error);
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive"
        });
        return false;
      }

      if (data.user) {
        toast({
          title: "Login Successful",
          description: "Welcome back!"
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Error",
        description: "An error occurred during login. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (credentials: LoginCredentials & { name: string; designation: string; departmentId: string }): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const email = credentials.employeeId.includes('@') ? credentials.employeeId : `${credentials.employeeId}@nmit.ac.in`;
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password: credentials.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            employee_id: credentials.employeeId,
            name: credentials.name,
            designation: credentials.designation,
            department_id: credentials.departmentId
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        toast({
          title: "Signup Failed",
          description: error.message,
          variant: "destructive"
        });
        return false;
      }

      if (data.user) {
        // Create user profile in our users table
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            auth_user_id: data.user.id,
            employee_id: credentials.employeeId,
            name: credentials.name,
            email: email,
            role: 'faculty', // Default role
            department_id: credentials.departmentId,
            designation: credentials.designation,
            institution: 'NMIT'
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          toast({
            title: "Profile Creation Failed",
            description: "Account created but profile setup failed. Please contact admin.",
            variant: "destructive"
          });
          return false;
        }

        toast({
          title: "Account Created",
          description: "Please check your email to confirm your account.",
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: "Signup Error",
        description: "An error occurred during signup. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        toast({
          title: "Logout Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      setUser(null);
      setSession(null);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out."
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Logout Error",
        description: "An error occurred during logout.",
        variant: "destructive"
      });
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value = {
    user,
    session,
    isLoading,
    login,
    signup,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
