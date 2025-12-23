import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { InstallPromptBanner } from "@/components/InstallPromptBanner";
import { DocumentCompletionNotifier } from "@/components/DocumentCompletionNotifier";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import UploadDocument from "./pages/UploadDocument";
import MyDocuments from "./pages/MyDocuments";
import BuyCredits from "./pages/BuyCredits";
import PaymentHistory from "./pages/PaymentHistory";
import DocumentQueue from "./pages/DocumentQueue";
import AdminUsers from "./pages/AdminUsers";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminSettings from "./pages/AdminSettings";
import AdminPricing from "./pages/AdminPricing";
import AdminMagicLinks from "./pages/AdminMagicLinks";
import AdminActivityLogs from "./pages/AdminActivityLogs";
import AdminSystemHealth from "./pages/AdminSystemHealth";
import AdminRevenue from "./pages/AdminRevenue";
import AdminReports from "./pages/AdminReports";
import AdminPromoCodes from "./pages/AdminPromoCodes";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminNotifications from "./pages/AdminNotifications";
import AdminSupportTickets from "./pages/AdminSupportTickets";
import AdminBlockedUsers from "./pages/AdminBlockedUsers";
import AdminCryptoPayments from "./pages/AdminCryptoPayments";
import AdminManualPayments from "./pages/AdminManualPayments";
import AdminVivaPayments from "./pages/AdminVivaPayments";
import AdminStaffPermissions from "./pages/AdminStaffPermissions";
import AdminEmails from "./pages/AdminEmails";
import StaffStats from "./pages/StaffStats";
import StaffProcessed from "./pages/StaffProcessed";
import Profile from "./pages/Profile";
import AdminStaffWork from "./pages/AdminStaffWork";
import GuestUpload from "./pages/GuestUpload";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import AdminDashboardOverview from "./pages/AdminDashboardOverview";
import StaffPerformance from "./pages/StaffPerformance";
import CustomerDocumentAnalytics from "./pages/CustomerDocumentAnalytics";
import Maintenance from "./pages/Maintenance";
import AdminAIHelper from "./pages/AdminAIHelper";
import AdminBulkReportUpload from "./pages/AdminBulkReportUpload";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles, bypassMaintenance = false }: { children: React.ReactNode; allowedRoles?: string[]; bypassMaintenance?: boolean }) => {
  const { user, role, loading } = useAuth();
  const { isMaintenanceMode, loading: maintenanceLoading } = useMaintenanceMode();
  
  if (loading || maintenanceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  // Show maintenance page for public routes during maintenance
  if (isMaintenanceMode) {
    return <Maintenance />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => (
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
    
    {/* Staff Routes */}
    <Route path="/dashboard/queue" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><DocumentQueue /></ProtectedRoute>} />
    <Route path="/dashboard/my-work" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><StaffProcessed /></ProtectedRoute>} />
    <Route path="/dashboard/stats" element={<ProtectedRoute allowedRoles={['staff', 'admin']}><StaffStats /></ProtectedRoute>} />
    
    {/* Admin Routes */}
    <Route path="/dashboard/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
    <Route path="/dashboard/analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnalytics /></ProtectedRoute>} />
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
    <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <DocumentCompletionNotifier />
            <AppRoutes />
            <InstallPromptBanner />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;