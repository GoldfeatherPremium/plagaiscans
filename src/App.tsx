import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

// Lazy load non-critical components
const InstallPromptBanner = lazy(() => import("@/components/InstallPromptBanner").then(m => ({ default: m.InstallPromptBanner })));
const DocumentCompletionNotifier = lazy(() => import("@/components/DocumentCompletionNotifier").then(m => ({ default: m.DocumentCompletionNotifier })));

// Lazy load all pages for better code splitting and LCP
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Maintenance = lazy(() => import("./pages/Maintenance"));

// Lazy loaded pages (split into separate chunks)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const UploadDocument = lazy(() => import("./pages/UploadDocument"));
const MyDocuments = lazy(() => import("./pages/MyDocuments"));
const BuyCredits = lazy(() => import("./pages/BuyCredits"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const DocumentQueue = lazy(() => import("./pages/DocumentQueue"));
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
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminSupportTickets = lazy(() => import("./pages/AdminSupportTickets"));
const AdminBlockedUsers = lazy(() => import("./pages/AdminBlockedUsers"));
const AdminCryptoPayments = lazy(() => import("./pages/AdminCryptoPayments"));
const AdminManualPayments = lazy(() => import("./pages/AdminManualPayments"));
const AdminVivaPayments = lazy(() => import("./pages/AdminVivaPayments"));
const AdminStaffPermissions = lazy(() => import("./pages/AdminStaffPermissions"));
const AdminEmails = lazy(() => import("./pages/AdminEmails"));
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
const AdminUnmatchedReports = lazy(() => import("./pages/AdminUnmatchedReports"));
const AdminNeedsReview = lazy(() => import("./pages/AdminNeedsReview"));
const ReferralProgram = lazy(() => import("./pages/ReferralProgram"));

const queryClient = new QueryClient();

// Loading spinner component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const ProtectedRoute = ({ children, allowedRoles, bypassMaintenance = false }: { children: React.ReactNode; allowedRoles?: string[]; bypassMaintenance?: boolean }) => {
  const { user, role, loading } = useAuth();
  const { isMaintenanceMode, loading: maintenanceLoading } = useMaintenanceMode();
  
  if (loading || maintenanceLoading) {
    return <PageLoader />;
  }
  
  if (!user) return <Navigate to="/auth" replace />;
  
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
  const { isMaintenanceMode, loading: maintenanceLoading } = useMaintenanceMode();
  
  if (loading || maintenanceLoading) {
    return <PageLoader />;
  }
  
  // If user is logged in, check their role before redirecting
  if (user) {
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
  
  if (loading) {
    return <PageLoader />;
  }
  
  // Show maintenance page for public routes during maintenance
  if (isMaintenanceMode) {
    return <Maintenance />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      <Route path="/install" element={<Install />} />
      <Route path="/guest-upload" element={<PublicRoute><GuestUpload /></PublicRoute>} />
      
      {/* Customer Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard/upload" element={<ProtectedRoute allowedRoles={['customer']}><UploadDocument /></ProtectedRoute>} />
      <Route path="/dashboard/documents" element={<ProtectedRoute><MyDocuments /></ProtectedRoute>} />
      <Route path="/dashboard/credits" element={<ProtectedRoute allowedRoles={['customer', 'admin']}><BuyCredits /></ProtectedRoute>} />
      <Route path="/dashboard/payments" element={<ProtectedRoute allowedRoles={['customer']}><PaymentHistory /></ProtectedRoute>} />
      <Route path="/dashboard/checkout" element={<ProtectedRoute allowedRoles={['customer', 'admin']}><Checkout /></ProtectedRoute>} />
      <Route path="/dashboard/analytics" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDocumentAnalytics /></ProtectedRoute>} />
      <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={['customer']}><ReferralProgram /></ProtectedRoute>} />
      
      {/* Staff Routes */}
      <Route path="/dashboard/queue" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><DocumentQueue /></ProtectedRoute>} />
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
      <Route path="/dashboard/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/dashboard/notifications" element={<ProtectedRoute allowedRoles={['admin']}><AdminNotifications /></ProtectedRoute>} />
      <Route path="/dashboard/support-tickets" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupportTickets /></ProtectedRoute>} />
      <Route path="/dashboard/blocked-users" element={<ProtectedRoute allowedRoles={['admin']}><AdminBlockedUsers /></ProtectedRoute>} />
      <Route path="/dashboard/crypto-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminCryptoPayments /></ProtectedRoute>} />
      <Route path="/dashboard/manual-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminManualPayments /></ProtectedRoute>} />
      <Route path="/dashboard/viva-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminVivaPayments /></ProtectedRoute>} />
      <Route path="/dashboard/staff-permissions" element={<ProtectedRoute allowedRoles={['admin']}><AdminStaffPermissions /></ProtectedRoute>} />
      <Route path="/dashboard/emails" element={<ProtectedRoute allowedRoles={['admin']}><AdminEmails /></ProtectedRoute>} />
      <Route path="/dashboard/overview" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboardOverview /></ProtectedRoute>} />
      <Route path="/dashboard/staff-performance" element={<ProtectedRoute allowedRoles={['admin']}><StaffPerformance /></ProtectedRoute>} />
      <Route path="/dashboard/ai-helper" element={<ProtectedRoute allowedRoles={['admin']}><AdminAIHelper /></ProtectedRoute>} />
      <Route path="/dashboard/bulk-upload" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdminBulkReportUpload /></ProtectedRoute>} />
      <Route path="/dashboard/unmatched-reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminUnmatchedReports /></ProtectedRoute>} />
      <Route path="/dashboard/needs-review" element={<ProtectedRoute allowedRoles={['admin']}><AdminNeedsReview /></ProtectedRoute>} />
      <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={['admin']}><AdminReferrals /></ProtectedRoute>} />
      <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

// Lazy load AdminReferrals
const AdminReferrals = lazy(() => import("./pages/AdminReferrals"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={null}>
              <DocumentCompletionNotifier />
            </Suspense>
            <AppRoutes />
            <Suspense fallback={null}>
              <InstallPromptBanner />
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
