import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// Session timeout settings (in minutes)
const SESSION_TIMEOUT_MINUTES = 30;
const SESSION_WARNING_MINUTES = 5;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [loading, setLoading] = useState(true);
  
  // Auto-logout refs
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (profileData) {
        setProfile({
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          phone: profileData.phone,
          credit_balance: profileData.credit_balance,
        });
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) throw roleError;
      
      if (roleData) {
        setRole(roleData.role as AppRole);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const signOut = useCallback(async () => {
    // Clear timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  }, []);

  // Auto-logout functionality
  const clearAutoLogoutTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleAutoLogout = useCallback(async () => {
    clearAutoLogoutTimers();
    toast.info('Session expired due to inactivity', {
      description: 'Please log in again to continue.',
      duration: 5000,
    });
    await signOut();
  }, [signOut, clearAutoLogoutTimers]);

  const showSessionWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      toast.warning(`Session expiring in ${SESSION_WARNING_MINUTES} minutes`, {
        description: 'Move your mouse or press a key to stay logged in.',
        duration: 10000,
      });
    }
  }, []);

  const resetAutoLogoutTimer = useCallback(() => {
    if (!user) return;

    clearAutoLogoutTimers();
    warningShownRef.current = false;

    const timeoutMs = SESSION_TIMEOUT_MINUTES * 60 * 1000;
    const warningMs = (SESSION_TIMEOUT_MINUTES - SESSION_WARNING_MINUTES) * 60 * 1000;

    // Set warning timer
    if (SESSION_WARNING_MINUTES > 0 && warningMs > 0) {
      warningRef.current = setTimeout(showSessionWarning, warningMs);
    }

    // Set logout timer
    timeoutRef.current = setTimeout(handleAutoLogout, timeoutMs);
  }, [user, clearAutoLogoutTimers, showSessionWarning, handleAutoLogout]);

  // Set up activity listeners for auto-logout
  useEffect(() => {
    if (!user) {
      clearAutoLogoutTimers();
      return;
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    let lastReset = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 1000) {
        lastReset = now;
        resetAutoLogoutTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledReset, { passive: true });
    });

    resetAutoLogoutTimer();

    return () => {
      clearAutoLogoutTimers();
      events.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });
    };
  }, [user, resetAutoLogoutTimer, clearAutoLogoutTimers]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserData(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
      }
      
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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