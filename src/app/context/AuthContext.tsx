import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, Customer } from '@/lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  verified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;

  // Email auth
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string, marketingOptIn?: boolean) => Promise<{ error: AuthError | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;

  // Phone auth
  signInWithPhone: (phone: string) => Promise<{ error: AuthError | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: AuthError | null }>;

  // Email verification
  resendEmailVerification: () => Promise<{ error: AuthError | null }>;

  // Password reset
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;

  // Session management
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Transform Supabase user to our AuthUser format
  const transformUser = async (supabaseUser: User | null): Promise<AuthUser | null> => {
    if (!supabaseUser) return null;

    // Fetch customer profile from our customers table
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    return {
      id: supabaseUser.id,
      firstName: customer?.first_name || supabaseUser.user_metadata?.first_name || '',
      lastName: customer?.last_name || supabaseUser.user_metadata?.last_name || '',
      email: supabaseUser.email || '',
      phone: supabaseUser.phone || customer?.phone,
      verified: supabaseUser.email_confirmed_at !== null || supabaseUser.phone_confirmed_at !== null,
      emailVerified: supabaseUser.email_confirmed_at !== null,
      phoneVerified: supabaseUser.phone_confirmed_at !== null,
    };
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);

        if (initialSession?.user) {
          const authUser = await transformUser(initialSession.user);
          setUser(authUser);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state change:', event);
      setSession(newSession);

      if (newSession?.user) {
        const authUser = await transformUser(newSession.user);
        setUser(authUser);
      } else {
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign up with email
  const signUpWithEmail = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    marketingOptIn: boolean = false
  ): Promise<{ error: AuthError | null }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        emailRedirectTo: `${window.location.origin}/account`,
      },
    });

    if (!error && data.user) {
      // Create customer record in our database
      await supabase.from('customers').upsert({
        id: data.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        email_verified: false,
        phone_verified: false,
        marketing_opt_in: marketingOptIn,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return { error };
  };

  // Sign in with email
  const signInWithEmail = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // Sign in with phone (sends OTP)
  const signInWithPhone = async (phone: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { error };
  };

  // Verify phone OTP
  const verifyPhoneOtp = async (phone: string, token: string): Promise<{ error: AuthError | null }> => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (!error && data.user) {
      // Update customer phone verification status
      await supabase
        .from('customers')
        .update({
          phone: phone,
          phone_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.user.id);
    }

    return { error };
  };

  // Resend email verification
  const resendEmailVerification = async (): Promise<{ error: AuthError | null }> => {
    if (!user?.email) {
      return { error: { message: 'No email address found', name: 'AuthError', status: 400 } as AuthError };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
      },
    });
    return { error };
  };

  // Reset password
  const resetPassword = async (email: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/settings?reset=true`,
    });
    return { error };
  };

  // Update password
  const updatePassword = async (newPassword: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  // Logout
  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Refresh session
  const refreshSession = async (): Promise<void> => {
    const { data: { session: newSession } } = await supabase.auth.refreshSession();
    if (newSession) {
      setSession(newSession);
      const authUser = await transformUser(newSession.user);
      setUser(authUser);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      signUpWithEmail,
      signInWithEmail,
      signInWithPhone,
      verifyPhoneOtp,
      resendEmailVerification,
      resetPassword,
      updatePassword,
      logout,
      refreshSession,
    }}>
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
