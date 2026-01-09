import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { RefreshProgressBar } from "@/components/RefreshProgressBar";

// Lazy load non-critical components
const InstallPromptBanner = lazy(() => import("@/components/InstallPromptBanner").then(m => ({ default: m.InstallPromptBanner })));
const SmartInstallPopup = lazy(() => import("@/components/SmartInstallPopup").then(m => ({ default: m.SmartInstallPopup })));
const DocumentCompletionNotifier = lazy(() => import("@/components/DocumentCompletionNotifier").then(m => ({ default: m.DocumentCompletionNotifier })));

// Lazy load all pages for better code splitting and LCP
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const Maintenance = lazy(() => import("./pages/Maintenance"));

// Lazy loaded pages (split into separate chunks)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const UploadDocument = lazy(() => import("./pages/UploadDocument"));
const UploadSimilarity = lazy(() => import("./pages/UploadSimilarity"));
const MyDocuments = lazy(() => import("./pages/MyDocuments"));
const BuyCredits = lazy(() => import("./pages/BuyCredits"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const DocumentQueue = lazy(() => import("./pages/DocumentQueue"));
const SimilarityQueue = lazy(() => import("./pages/SimilarityQueue"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminPricing = lazy(() => import("./pages/AdminPricing"));
const AdminMagicLinks = lazy(() => import("./pages/AdminMagicLinks"));
const AdminActivityLogs = lazy(() => import("./pages/AdminActivityLogs"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth"));
const AdminRevenue = lazy(() => import("./pages/AdminRevenue"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminPromoCodes = lazy(() => import("./pages/AdminPromoCodes"));
const AdminPromoAnalytics = lazy(() => import("./pages/AdminPromoAnalytics"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminSupportTickets = lazy(() => import("./pages/AdminSupportTickets"));
const AdminBlockedUsers = lazy(() => import("./pages/AdminBlockedUsers"));
const AdminCryptoPayments = lazy(() => import("./pages/AdminCryptoPayments"));
const AdminManualPayments = lazy(() => import("./pages/AdminManualPayments"));

const AdminStaffPermissions = lazy(() => import("./pages/AdminStaffPermissions"));
const AdminEmails = lazy(() => import("./pages/AdminEmails"));
const AdminEmailDeliveryLogs = lazy(() => import("./pages/AdminEmailDeliveryLogs"));
const StaffStats = lazy(() => import("./pages/StaffStats"));
const StaffProcessed = lazy(() => import("./pages/StaffProcessed"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminStaffWork = lazy(() => import("./pages/AdminStaffWork"));
const GuestUpload = lazy(() => import("./pages/GuestUpload"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Checkout = lazy(() => import("./pages/Checkout"));
const AdminDashboardOverview = lazy(() => import("./pages/AdminDashboardOverview"));
const StaffPerformance = lazy(() => import("./pages/StaffPerformance"));
const CustomerDocumentAnalytics = lazy(() => import("./pages/CustomerDocumentAnalytics"));
const AdminAIHelper = lazy(() => import("./pages/AdminAIHelper"));
const AdminBulkReportUpload = lazy(() => import("./pages/AdminBulkReportUpload"));
const AdminSimilarityBulkUpload = lazy(() => import("./pages/AdminSimilarityBulkUpload"));
const AdminUnmatchedReports = lazy(() => import("./pages/AdminUnmatchedReports"));
const AdminNeedsReview = lazy(() => import("./pages/AdminNeedsReview"));
const ReferralProgram = lazy(() => import("./pages/ReferralProgram"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const ContactPage = lazy(() => import("./pages/Contact"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const AdminSiteContent = lazy(() => import("./pages/AdminSiteContent"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const FAQ = lazy(() => import("./pages/FAQ"));
const AcademicIntegrity = lazy(() => import("./pages/AcademicIntegrity"));
const Resources = lazy(() => import("./pages/Resources"));
const Article = lazy(() => import("./pages/Article"));
const AdminRefundRequests = lazy(() => import("./pages/AdminRefundRequests"));
const PlagiarismChecker = lazy(() => import("./pages/PlagiarismChecker"));
const SimilarityReport = lazy(() => import("./pages/SimilarityReport"));
const AIContentDetection = lazy(() => import("./pages/AIContentDetection"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const SubscriptionManagement = lazy(() => import("./pages/SubscriptionManagement"));
const AdminStripePayments = lazy(() => import("./pages/AdminStripePayments"));
const AdminReferrals = lazy(() => import("./pages/AdminReferrals"));
const AdminWebhookLogs = lazy(() => import("./pages/AdminWebhookLogs"));
const AdminUnifiedPayments = lazy(() => import("./pages/AdminUnifiedPayments"));
const MyInvoices = lazy(() => import("./pages/MyInvoices"));
const MyReceipts = lazy(() => import("./pages/MyReceipts"));
const AdminInvoices = lazy(() => import("./pages/AdminInvoices"));
const AdminBankStatements = lazy(() => import("./pages/AdminBankStatements"));
const AdminCreditValidity = lazy(() => import("./pages/AdminCreditValidity"));
const AdminDeletedDocuments = lazy(() => import("./pages/AdminDeletedDocuments"));
const AdminExtensionManager = lazy(() => import("./pages/AdminExtensionManager"));
const ExtensionSetup = lazy(() => import("./pages/ExtensionSetup"));
const queryClient = new QueryClient();

// Loading skeleton component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen bg-background p-8 pt-24">
    <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
      {/* Header shimmer */}
      <div className="space-y-2">
        <div className="h-9 w-64 bg-muted rounded" />
        <div className="h-5 w-96 bg-muted rounded" />
      </div>
      
      {/* Stats grid shimmer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-8 w-12 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Content shimmer */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-6 border-b">
          <div className="h-6 w-40 bg-muted rounded" />
        </div>
        <div className="divide-y">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4" style={{ opacity: 1 - (i * 0.15) }}>
              <div className="h-4 w-8 bg-muted rounded" />
              <div className="h-4 flex-1 max-w-[200px] bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-6 w-16 bg-muted rounded-full" />
              <div className="h-8 w-8 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles, bypassMaintenance = false, allowIncompleteProfile = false }: { children: React.ReactNode; allowedRoles?: string[]; bypassMaintenance?: boolean; allowIncompleteProfile?: boolean }) => {
  const { user, role, loading, needsPhoneNumber } = useAuth();
  const { isMaintenanceMode, loading: maintenanceLoading } = useMaintenanceMode();
  
  if (loading || maintenanceLoading) {
    return <PageLoader />;
  }
  
  if (!user) return <Navigate to="/auth" replace />;
  
  // Redirect to complete profile if phone number is missing (OAuth users)
  if (needsPhoneNumber && !allowIncompleteProfile) {
    return <Navigate to="/complete-profile" replace />;
  }
  
  // Allow admins to bypass maintenance mode, block customers and staff
  if (isMaintenanceMode && !bypassMaintenance && role !== 'admin') {
    return <Maintenance />;
  }
  
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { loading: maintenanceLoading } = useMaintenanceMode();
  const location = useLocation();

  const searchReset = new URLSearchParams(location.search).get("reset") === "true";
  const hashParams = new URLSearchParams(location.hash?.startsWith("#") ? location.hash.slice(1) : "");
  const hashRecovery = hashParams.get("type") === "recovery";

  const isResetFlow = searchReset || hashRecovery;

  if (loading || maintenanceLoading) {
    return <PageLoader />;
  }

  // CRITICAL: do not override the password reset flow.
  // Recovery links may create a temporary session; we must still show the reset UI.
  if (user && !isResetFlow) {
    // During maintenance, only redirect admins to dashboard
    // Others will be handled by ProtectedRoute's maintenance check
    return <Navigate to="/dashboard" replace />;
  }

  // Allow access to auth page even during maintenance (so users can login)
  return <>{children}</>;
};

// Wrapper for public routes that should show maintenance page
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isMaintenanceMode, loading } = useMaintenanceMode();

  // IMPORTANT: don't block initial paint on slow networks.
  // If maintenance is enabled, we'll swap to the Maintenance page as soon as the check completes.
  if (loading) {
    return <>{children}</>;
  }

  // Show maintenance page for public routes during maintenance
  if (isMaintenanceMode) {
    return <Maintenance />;
  }

  return <>{children}</>;
};

// If a recovery link lands on the wrong route, force it to the dedicated reset page.
const RecoveryLinkRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash?.startsWith("#") ? location.hash.slice(1) : "");
    const isRecovery = hashParams.get("type") === "recovery";

    if (isRecovery && location.pathname !== "/reset-password") {
      navigate(`/reset-password${location.hash}`, { replace: true });
    }
  }, [location.hash, location.pathname, navigate]);

  return null;
};

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <RecoveryLinkRedirect />
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/about-us" element={<AboutUs />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/faq" element={<FAQ />} />
        <Route path="/academic-integrity" element={<AcademicIntegrity />} />
        <Route path="/plagiarism-checker" element={<PlagiarismChecker />} />
        <Route path="/similarity-report" element={<SimilarityReport />} />
        <Route path="/ai-content-detection" element={<AIContentDetection />} />
        <Route path="/resources" element={<Resources />} />
      <Route path="/resources/:slug" element={<Article />} />
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      {/* Password reset page - bypasses auth checks to allow password change */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/complete-profile" element={<ProtectedRoute allowIncompleteProfile={true}><CompleteProfile /></ProtectedRoute>} />
      <Route path="/install" element={<Install />} />
      <Route path="/guest-upload" element={<PublicRoute><GuestUpload /></PublicRoute>} />
      
      {/* Customer Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard/upload" element={<ProtectedRoute allowedRoles={['customer']}><UploadDocument /></ProtectedRoute>} />
      <Route path="/dashboard/upload-similarity" element={<ProtectedRoute allowedRoles={['customer']}><UploadSimilarity /></ProtectedRoute>} />
      <Route path="/dashboard/documents" element={<ProtectedRoute><MyDocuments /></ProtectedRoute>} />
      <Route path="/dashboard/credits" element={<ProtectedRoute allowedRoles={['customer', 'admin']}><BuyCredits /></ProtectedRoute>} />
      <Route path="/dashboard/payments" element={<ProtectedRoute allowedRoles={['customer']}><PaymentHistory /></ProtectedRoute>} />
      <Route path="/dashboard/invoices" element={<ProtectedRoute allowedRoles={['customer']}><MyInvoices /></ProtectedRoute>} />
      <Route path="/dashboard/receipts" element={<ProtectedRoute allowedRoles={['customer']}><MyReceipts /></ProtectedRoute>} />
      <Route path="/dashboard/checkout" element={<ProtectedRoute allowedRoles={['customer', 'admin']}><Checkout /></ProtectedRoute>} />
      <Route path="/dashboard/payment-success" element={<ProtectedRoute allowedRoles={['customer', 'admin']}><PaymentSuccess /></ProtectedRoute>} />
      <Route path="/dashboard/subscription" element={<ProtectedRoute allowedRoles={['customer', 'admin']}><SubscriptionManagement /></ProtectedRoute>} />
      <Route path="/dashboard/analytics" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDocumentAnalytics /></ProtectedRoute>} />
      <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={['customer']}><ReferralProgram /></ProtectedRoute>} />
      
      {/* Staff Routes */}
      <Route path="/dashboard/queue" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><DocumentQueue /></ProtectedRoute>} />
      <Route path="/dashboard/queue-similarity" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><SimilarityQueue /></ProtectedRoute>} />
      <Route path="/dashboard/my-work" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><StaffProcessed /></ProtectedRoute>} />
      <Route path="/dashboard/stats" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><StaffStats /></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/dashboard/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/dashboard/admin-analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnalytics /></ProtectedRoute>} />
      <Route path="/dashboard/pricing" element={<ProtectedRoute allowedRoles={['admin']}><AdminPricing /></ProtectedRoute>} />
      <Route path="/dashboard/magic-links" element={<ProtectedRoute allowedRoles={['admin']}><AdminMagicLinks /></ProtectedRoute>} />
      <Route path="/dashboard/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
      <Route path="/dashboard/staff-work" element={<ProtectedRoute allowedRoles={['admin']}><AdminStaffWork /></ProtectedRoute>} />
      <Route path="/dashboard/activity-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminActivityLogs /></ProtectedRoute>} />
      <Route path="/dashboard/system-health" element={<ProtectedRoute allowedRoles={['admin']}><AdminSystemHealth /></ProtectedRoute>} />
      <Route path="/dashboard/revenue" element={<ProtectedRoute allowedRoles={['admin']}><AdminRevenue /></ProtectedRoute>} />
      <Route path="/dashboard/reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminReports /></ProtectedRoute>} />
      <Route path="/dashboard/promo-codes" element={<ProtectedRoute allowedRoles={['admin']}><AdminPromoCodes /></ProtectedRoute>} />
      <Route path="/dashboard/promo-analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminPromoAnalytics /></ProtectedRoute>} />
      <Route path="/dashboard/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/dashboard/notifications" element={<ProtectedRoute allowedRoles={['admin']}><AdminNotifications /></ProtectedRoute>} />
      <Route path="/dashboard/support-tickets" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupportTickets /></ProtectedRoute>} />
      <Route path="/dashboard/blocked-users" element={<ProtectedRoute allowedRoles={['admin']}><AdminBlockedUsers /></ProtectedRoute>} />
      <Route path="/dashboard/crypto-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminCryptoPayments /></ProtectedRoute>} />
      <Route path="/dashboard/manual-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminManualPayments /></ProtectedRoute>} />
      
      <Route path="/dashboard/staff-permissions" element={<ProtectedRoute allowedRoles={['admin']}><AdminStaffPermissions /></ProtectedRoute>} />
      <Route path="/dashboard/emails" element={<ProtectedRoute allowedRoles={['admin']}><AdminEmails /></ProtectedRoute>} />
      <Route path="/dashboard/email-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminEmailDeliveryLogs /></ProtectedRoute>} />
      <Route path="/dashboard/overview" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboardOverview /></ProtectedRoute>} />
      <Route path="/dashboard/staff-performance" element={<ProtectedRoute allowedRoles={['admin']}><StaffPerformance /></ProtectedRoute>} />
      <Route path="/dashboard/ai-helper" element={<ProtectedRoute allowedRoles={['admin']}><AdminAIHelper /></ProtectedRoute>} />
      <Route path="/dashboard/bulk-upload" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminBulkReportUpload /></ProtectedRoute>} />
      <Route path="/dashboard/similarity-bulk-upload" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminSimilarityBulkUpload /></ProtectedRoute>} />
      <Route path="/dashboard/unmatched-reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminUnmatchedReports /></ProtectedRoute>} />
      <Route path="/dashboard/needs-review" element={<ProtectedRoute allowedRoles={['admin']}><AdminNeedsReview /></ProtectedRoute>} />
      <Route path="/dashboard/site-content" element={<ProtectedRoute allowedRoles={['admin']}><AdminSiteContent /></ProtectedRoute>} />
      <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={['admin']}><AdminReferrals /></ProtectedRoute>} />
        <Route path="/dashboard/refund-requests" element={<ProtectedRoute allowedRoles={['admin']}><AdminRefundRequests /></ProtectedRoute>} />
        <Route path="/dashboard/stripe-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminStripePayments /></ProtectedRoute>} />
        <Route path="/dashboard/admin-invoices" element={<ProtectedRoute allowedRoles={['admin']}><AdminInvoices /></ProtectedRoute>} />
        <Route path="/dashboard/bank-statements" element={<ProtectedRoute allowedRoles={['admin']}><AdminBankStatements /></ProtectedRoute>} />
        <Route path="/dashboard/webhook-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminWebhookLogs /></ProtectedRoute>} />
        <Route path="/dashboard/all-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminUnifiedPayments /></ProtectedRoute>} />
        <Route path="/dashboard/credit-validity" element={<ProtectedRoute allowedRoles={['admin']}><AdminCreditValidity /></ProtectedRoute>} />
        <Route path="/dashboard/deleted-documents" element={<ProtectedRoute allowedRoles={['admin']}><AdminDeletedDocuments /></ProtectedRoute>} />
        <Route path="/dashboard/extension" element={<ProtectedRoute allowedRoles={['admin']}><AdminExtensionManager /></ProtectedRoute>} />
        <Route path="/dashboard/extension-setup" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><ExtensionSetup /></ProtectedRoute>} />
      <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <RefreshProgressBar />
            <Suspense fallback={null}>
              <DocumentCompletionNotifier />
            </Suspense>
            <AppRoutes />
            <DeferredNonCritical>
              <Suspense fallback={null}>
                <InstallPromptBanner />
                <SmartInstallPopup />
              </Suspense>
            </DeferredNonCritical>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

function DeferredNonCritical({
  children,
  delayMs = 1500,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (!cancelled) setEnabled(true);
    };

    // Prefer idle time; fallback to a short delay.
    const ric = (window as any).requestIdleCallback as
      | undefined
      | ((cb: () => void, opts?: { timeout: number }) => number);

    if (typeof ric === "function") {
      const id = ric(run, { timeout: delayMs });
      return () => {
        cancelled = true;
        try {
          (window as any).cancelIdleCallback?.(id);
        } catch {
          // ignore
        }
      };
    }

    const t = window.setTimeout(run, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [delayMs]);

  if (!enabled) return null;
  return <>{children}</>;
}
