import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, role: 'user' | 'admin') => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (role?: 'user' | 'admin', adminPassword?: string) => Promise<{ error: Error | null }>;
  // OTP flows
  sendEmailOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  sendPhoneOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// Normalize phone numbers for India: if the user enters a 10-digit local number,
// prefix with +91. Leave already international/E.164 numbers untouched.
const normalizeIndianPhone = (raw: string): string => {
  const cleaned = raw.trim();
  if (cleaned.startsWith('+')) return cleaned;

  const digitsOnly = cleaned.replace(/[^0-9]/g, '');
  const withoutLeadingZeros = digitsOnly.replace(/^0+/, '');

  if (/^91\d{10}$/.test(withoutLeadingZeros)) {
    return `+${withoutLeadingZeros}`;
  }

  if (/^\d{10}$/.test(withoutLeadingZeros)) {
    return `+91${withoutLeadingZeros}`;
  }

  return cleaned; // fallback; Supabase will validate format
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Apply pending role after OAuth redirect
  const applyPendingRole = useCallback(async (userId: string) => {
    const pendingRole = localStorage.getItem('pendingRole');
    if (!pendingRole) return;

    const desiredRole = pendingRole as 'user' | 'admin';
    try {
      const { data: existingRole, error: roleFetchError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleFetchError && roleFetchError.code !== 'PGRST116') {
        // PGRST116 = No rows found
        console.error('Error checking role:', roleFetchError);
      }

      if (!existingRole || !existingRole.role) {
        const { error: roleInsertError } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: desiredRole });
        if (roleInsertError) {
          console.error('Error setting role:', roleInsertError);
        }
      }
    } finally {
      localStorage.removeItem('pendingRole');
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user?.id) {
          applyPendingRole(currentSession.user.id);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user?.id) {
        applyPendingRole(existingSession.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen for profile deletion (admin deleted user) - auto logout
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-deletion')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          // Profile was deleted by admin - sign out
          toast.error('Your account has been deleted by an administrator.');
          supabase.auth.signOut();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: 'user' | 'admin') => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      // Insert role for the new user
      if (data.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: role,
          });

        if (roleError) {
          console.error('Error setting user role:', roleError);
        }
      }

      // Try to automatically sign in the newly created user
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          toast.success('Registration successful! Please check your email to confirm your account.');
        } else {
          toast.success('Registration successful! Welcome!');
        }
      } catch (err) {
        console.error('Auto sign-in error:', err);
        toast.success('Registration successful! Please check your email to confirm your account.');
      }

      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      toast.success('Welcome back!');
      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  const signInWithGoogle = useCallback(async (role: 'user' | 'admin' = 'user', adminPassword?: string) => {
    try {
      const redirectUrl = `${window.location.origin}`;

      if (role === 'admin') {
        if (!adminPassword) {
          toast.error('Admin password required for admin sign-in.');
          return { error: new Error('Admin password required') };
        }
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-admin', {
          body: { password: adminPassword }
        });
        if (verifyError || !verifyData?.valid) {
          toast.error('Invalid admin password');
          return { error: verifyError || new Error('Invalid admin password') };
        }
      }

      localStorage.setItem('pendingRole', role);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  }, [applyPendingRole]);

  // Send a magic link or code to email. Supabase will send either a magic link
  // or a 6-digit code depending on project Auth settings.
  const sendEmailOtp = useCallback(async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });
      if (error) {
        toast.error(error.message);
        return { error };
      }
      toast.success('We sent a login code/link to your email.');
      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  // Verify email OTP (6-digit code) if your Supabase project uses codes.
  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        type: 'email',
        email,
        token,
      });
      if (error) {
        toast.error(error.message);
        return { error };
      }
      toast.success('Email verified. Signed in!');
      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  // Send SMS OTP to a phone number (E.164 format), creates user if needed.
  const sendPhoneOtp = useCallback(async (phone: string) => {
    try {
      const normalizedPhone = normalizeIndianPhone(phone);
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) {
        toast.error(error.message);
        return { error };
      }
      toast.success('We sent an OTP to your phone.');
      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  // Verify phone OTP (6-digit code from SMS)
  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    try {
      const normalizedPhone = normalizeIndianPhone(phone);
      const { error } = await supabase.auth.verifyOtp({
        type: 'sms',
        phone: normalizedPhone,
        token,
      });
      if (error) {
        toast.error(error.message);
        return { error };
      }
      toast.success('Phone verified. Signed in!');
      return { error: null };
    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      return { error: err };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    toast.success('You have been logged out.');
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signInWithGoogle, sendEmailOtp, verifyEmailOtp, sendPhoneOtp, verifyPhoneOtp, signOut }}>
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
