import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'staff' | 'customer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    credit_balance: number;
  } | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [loading, setLoading] = useState(true);
  
  // Refs to prevent race conditions and duplicate fetches
  const fetchingRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const initializingRef = useRef(true);

  const fetchUserData = useCallback(async (userId: string) => {
    // Prevent duplicate concurrent fetches for the same user
    if (fetchingRef.current && lastFetchedUserIdRef.current === userId) {
      return;
    }
    
    fetchingRef.current = true;
    lastFetchedUserIdRef.current = userId;
    
    try {
      // Fetch profile and role in parallel to reduce requests
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      if (profileResult.error) throw profileResult.error;
      
      if (profileResult.data) {
        setProfile({
          id: profileResult.data.id,
          email: profileResult.data.email,
          full_name: profileResult.data.full_name,
          phone: profileResult.data.phone,
          credit_balance: profileResult.data.credit_balance,
        });
      }

      if (roleResult.error) throw roleResult.error;
      
      if (roleResult.data) {
        setRole(roleResult.data.role as AppRole);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  }, []);

  // Handle session-only mode (when "Remember me" is unchecked)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionOnly = sessionStorage.getItem('session_only');
      if (sessionOnly === 'true' && session) {
        // Clear auth data when browser closes if "Remember me" was not checked
        localStorage.removeItem('sb-fyssbzgmhnolazjfwafm-auth-token');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  useEffect(() => {
    // Prevent duplicate initialization
    if (!initializingRef.current) return;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log('Auth state change:', event);
      
      // Only update state if there's an actual change
      setSession(prev => {
        if (prev?.access_token === currentSession?.access_token) {
          return prev; // No change, don't trigger re-render
        }
        return currentSession;
      });
      
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        // Use setTimeout to defer Supabase calls and prevent deadlock
        setTimeout(() => {
          fetchUserData(currentSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        lastFetchedUserIdRef.current = null;
      }
      
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession) {
        setSession(existingSession);
        setUser(existingSession.user);
        fetchUserData(existingSession.user.id);
      }
      setLoading(false);
      initializingRef.current = false;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });
    
    // Send welcome email if signup was successful
    if (!error && data?.user) {
      try {
        console.log('Sending welcome email for new user:', data.user.id);
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            userId: data.user.id,
            email: email,
            fullName: fullName || null,
          },
        });
        console.log('Welcome email sent successfully');
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
