import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FileCheck, Loader2, ArrowLeft, Eye, EyeOff, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { WhatsAppSupportButton } from '@/components/WhatsAppSupportButton';
import { PhoneInput } from '@/components/PhoneInput';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { SEO } from '@/components/SEO';
import { useTranslation } from 'react-i18next';

// Strong password validation: 8+ chars, uppercase, lowercase, number, special char
const strongPasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character (!@#$%^&*)');

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const resetPasswordSchema = z.object({
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// OAuth timeout duration (30 seconds)
const OAUTH_TIMEOUT_MS = 30000;

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('reset') === 'true';
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation('auth');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const oauthTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [signupData, setSignupData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);

  // Check for OAuth error in URL (when user cancels or error occurs)
  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.replace('#', ''));
    const errorParam = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    if (errorParam) {
      let errorMessage = 'Authentication was cancelled or failed.';
      
      if (errorParam === 'access_denied') {
        errorMessage = 'You cancelled the sign-in process. Please try again when ready.';
      } else if (errorDescription) {
        errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      }
      
      toast({
        title: 'Sign In Cancelled',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Clean up the URL by removing the hash
      window.history.replaceState(null, '', location.pathname);
    }
  }, [location.hash, toast]);

  // Cleanup OAuth timeout on unmount
  useEffect(() => {
    return () => {
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchGoogleOAuthSetting = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_oauth_enabled')
        .single();
      setGoogleOAuthEnabled(data?.value === 'true');
    };
    fetchGoogleOAuthSetting();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    
    // Store preference for session persistence
    if (!rememberMe) {
      // If not remembering, we'll clear session on browser close via sessionStorage flag
      sessionStorage.setItem('session_only', 'true');
    } else {
      sessionStorage.removeItem('session_only');
    }
    
    const { error } = await signIn(loginData.email, loginData.password);
    setLoading(false);

    if (error) {
      toast({
        title: t('login.errorTitle'),
        description: error.message || t('login.errorMessage'),
        variant: 'destructive',
      });
    } else {
      toast({ title: t('login.successMessage') });
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Check phone validation first
    if (!isPhoneValid) {
      setErrors({ phone: t('validation.phoneInvalid') });
      return;
    }

    const result = signupSchema.safeParse(signupData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signUp(
      signupData.email,
      signupData.password,
      signupData.fullName,
      signupData.phone
    );
    setLoading(false);

    if (error) {
      let message = error.message;
      if (message.includes('already registered')) {
        message = t('signup.errorAlreadyRegistered');
      }
      toast({
        title: t('signup.errorTitle'),
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({ title: t('signup.successMessage') });
      navigate('/dashboard');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    // Set a timeout to handle cases where user doesn't complete OAuth
    // (e.g., closes the popup/tab, takes too long, etc.)
    oauthTimeoutRef.current = setTimeout(() => {
      // Only reset if we're still in loading state (user came back without completing)
      setGoogleLoading(false);
      toast({
        title: 'Sign In Timeout',
        description: 'The sign-in process took too long. Please try again.',
        variant: 'destructive',
      });
    }, OAUTH_TIMEOUT_MS);
    
    const { error } = await signInWithGoogle();
    
    // If there's an error, reset loading state and show toast
    if (error) {
      if (oauthTimeoutRef.current) {
        clearTimeout(oauthTimeoutRef.current);
      }
      setGoogleLoading(false);
      toast({
        title: 'Google Sign In Failed',
        description: error.message || 'Could not sign in with Google',
        variant: 'destructive',
      });
    }
    // Note: If no error, we don't reset googleLoading because
    // the browser will redirect to Google's OAuth page
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const emailValidation = z.string().email('Invalid email address').safeParse(forgotEmail);
    if (!emailValidation.success) {
      setErrors({ forgotEmail: t('validation.emailInvalid') });
      return;
    }

    setLoading(true);
    try {
      // Use custom edge function to send password reset email from our domain
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: forgotEmail }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: t('forgotPassword.successTitle'),
        description: t('forgotPassword.successMessage'),
      });
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (error: any) {
      toast({
        title: t('forgotPassword.errorTitle'),
        description: error.message || t('forgotPassword.errorMessage'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = resetPasswordSchema.safeParse(resetPasswordData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: resetPasswordData.password,
      });

      if (error) throw error;

      toast({
        title: t('resetPassword.successTitle'),
        description: t('resetPassword.successMessage'),
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: t('resetPassword.errorTitle'),
        description: error.message || t('resetPassword.errorMessage'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset password mode (after clicking email link)
  if (isResetMode) {
    return (
      <>
        <SEO
          title={t('resetPassword.title')}
          description="Set a new password for your PlagaiScans account."
          noIndex={true}
        />
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-2xl">PlagaiScans</span>
            </div>
            <p className="text-muted-foreground">{t('resetPassword.subtitle')}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('resetPassword.title')}</CardTitle>
              <CardDescription>{t('resetPassword.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('resetPassword.newPasswordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showResetPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={resetPasswordData.password}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, password: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <PasswordStrengthIndicator password={resetPasswordData.password} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">{t('resetPassword.confirmPasswordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="confirm-new-password"
                      type={showResetConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={resetPasswordData.confirmPassword}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    >
                      {showResetConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('resetPassword.submitButton')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        </div>
      </>
    );
  }

  // Forgot password view
  if (showForgotPassword) {
    return (
      <>
        <SEO
          title={t('forgotPassword.title')}
          description="Reset your PlagaiScans password."
          noIndex={true}
        />
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-2xl">PlagaiScans</span>
            </div>
            <p className="text-muted-foreground">{t('forgotPassword.subtitle')}</p>
          </div>

          <Card>
            <CardHeader>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit mb-2"
                onClick={() => setShowForgotPassword(false)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('forgotPassword.backToLogin')}
              </Button>
              <CardTitle>{t('forgotPassword.title')}</CardTitle>
              <CardDescription>{t('forgotPassword.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">{t('login.emailLabel')}</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder={t('login.emailPlaceholder')}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                  {errors.forgotEmail && <p className="text-sm text-destructive">{errors.forgotEmail}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('forgotPassword.submitButton')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        </div>
      </>
    );
  }

  // Full-screen OAuth loading overlay
  if (googleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
              <FileCheck className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl">PlagaiScans</span>
          </div>
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Connecting to Google...</p>
            <p className="text-sm text-muted-foreground">
              Please complete the sign-in in the new window
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => {
                if (oauthTimeoutRef.current) {
                  clearTimeout(oauthTimeoutRef.current);
                }
                setGoogleLoading(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('login.title')}
        description="Log in or create an account to access PlagaiScans document analysis and content review tools."
        noIndex={true}
      />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl">PlagaiScans</span>
          </div>
          <p className="text-muted-foreground">{t('login.subtitle')}</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('login.welcomeBack')}</CardTitle>
              <CardDescription>{t('login.description')}</CardDescription>
            </div>
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">{t('login.tabLogin')}</TabsTrigger>
                <TabsTrigger value="signup">{t('login.tabSignup')}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('login.emailLabel')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('login.emailPlaceholder')}
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t('login.passwordLabel')}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="remember" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                      />
                      <label
                        htmlFor="remember"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {t('login.rememberMe')}
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm text-primary"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      {t('login.forgotPassword')}
                    </Button>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('login.submitButton')}
                  </Button>
                </form>
                
                {/* Google OAuth */}
                {googleOAuthEnabled && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">{t('login.orContinueWith')}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading}
                    >
                      {googleLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                      )}
                      {t('login.googleButton')}
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t('signup.fullNameLabel')}</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder={t('signup.fullNamePlaceholder')}
                      value={signupData.fullName}
                      onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                    />
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('signup.emailLabel')}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t('signup.emailPlaceholder')}
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('signup.phoneLabel')}</Label>
                    <PhoneInput
                      value={signupData.phone}
                      onChange={(value, isValid) => {
                        setSignupData({ ...signupData, phone: value });
                        setIsPhoneValid(isValid);
                      }}
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('signup.passwordLabel')}</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                      >
                        {showSignupPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    <PasswordStrengthIndicator password={signupData.password} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('signup.confirmPasswordLabel')}</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupData.confirmPassword}
                        onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('signup.termsText')}{' '}
                    <Link to="/terms" className="text-primary hover:underline">{t('signup.termsLink')}</Link>{' '}
                    {t('signup.andText')}{' '}
                    <Link to="/privacy" className="text-primary hover:underline">{t('signup.privacyLink')}</Link>.
                  </p>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('signup.submitButton')}
                  </Button>
                </form>
                
                {/* Google OAuth for Signup */}
                {googleOAuthEnabled && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">{t('login.orContinueWith')}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading}
                    >
                      {googleLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                      )}
                      {t('signup.googleButton')}
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <WhatsAppSupportButton />
      </div>
    </>
  );
}
