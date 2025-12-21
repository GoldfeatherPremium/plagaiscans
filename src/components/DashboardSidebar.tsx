import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  Settings,
  LogOut,
  Upload,
  BarChart3,
  FileCheck,
  Menu,
  X,
  User,
  ClipboardList,
  Activity,
  Server,
  DollarSign,
  FileDown,
  Ticket,
  Megaphone,
  ShieldBan,
  MessageSquare,
  Wallet,
  Receipt,
  Shield,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  UserCog,
  PieChart,
  Bell,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface NavLink {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  links: NavLink[];
}

export const DashboardSidebar: React.FC = () => {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const customerLinks: NavLink[] = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/dashboard/upload', icon: Upload, label: 'Upload Document' },
    { to: '/dashboard/documents', icon: FileText, label: 'My Documents' },
    { to: '/dashboard/credits', icon: CreditCard, label: 'Buy Credits' },
    { to: '/dashboard/payments', icon: Receipt, label: 'Payment History' },
    { to: '/dashboard/profile', icon: User, label: 'Profile' },
  ];

  const staffLinks: NavLink[] = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/dashboard/queue', icon: FileCheck, label: 'Document Queue' },
    { to: '/dashboard/my-work', icon: FileText, label: 'My Processed' },
    { to: '/dashboard/stats', icon: BarChart3, label: 'My Stats' },
    { to: '/dashboard/profile', icon: User, label: 'Profile' },
  ];

  // Admin grouped navigation
  const adminGroups: NavGroup[] = [
    {
      label: 'Documents',
      icon: FolderOpen,
      links: [
        { to: '/dashboard/queue', icon: FileCheck, label: 'Queue' },
        { to: '/dashboard/documents', icon: FileText, label: 'All Documents' },
        { to: '/dashboard/magic-links', icon: Upload, label: 'Magic Links' },
      ],
    },
    {
      label: 'Users & Staff',
      icon: UserCog,
      links: [
        { to: '/dashboard/users', icon: Users, label: 'Users' },
        { to: '/dashboard/staff-work', icon: ClipboardList, label: 'Staff Work' },
        { to: '/dashboard/staff-permissions', icon: Shield, label: 'Permissions' },
        { to: '/dashboard/blocked-users', icon: ShieldBan, label: 'Blocked' },
      ],
    },
    {
      label: 'Payments',
      icon: Wallet,
      links: [
        { to: '/dashboard/pricing', icon: CreditCard, label: 'Pricing' },
        { to: '/dashboard/promo-codes', icon: Ticket, label: 'Promo Codes' },
        { to: '/dashboard/revenue', icon: DollarSign, label: 'Revenue' },
        { to: '/dashboard/crypto-payments', icon: CreditCard, label: 'Crypto' },
        { to: '/dashboard/manual-payments', icon: Wallet, label: 'Manual' },
      ],
    },
    {
      label: 'Analytics',
      icon: PieChart,
      links: [
        { to: '/dashboard/analytics', icon: BarChart3, label: 'Overview' },
        { to: '/dashboard/activity-logs', icon: Activity, label: 'Activity Logs' },
        { to: '/dashboard/system-health', icon: Server, label: 'System Health' },
        { to: '/dashboard/reports', icon: FileDown, label: 'Reports' },
      ],
    },
    {
      label: 'Communication',
      icon: Bell,
      links: [
        { to: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
        { to: '/dashboard/support-tickets', icon: MessageSquare, label: 'Support' },
      ],
    },
    {
      label: 'Settings',
      icon: Wrench,
      links: [
        { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
        { to: '/dashboard/profile', icon: User, label: 'Profile' },
      ],
    },
  ];

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups(prev => 
      prev.includes(groupLabel) 
        ? prev.filter(g => g !== groupLabel)
        : [...prev, groupLabel]
    );
  };

  // Auto-expand group containing current route
  useEffect(() => {
    if (role === 'admin') {
      const currentGroup = adminGroups.find(group => 
        group.links.some(link => link.to === location.pathname)
      );
      if (currentGroup && !openGroups.includes(currentGroup.label)) {
        setOpenGroups(prev => [...prev, currentGroup.label]);
      }
    }
  }, [location.pathname, role]);

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const renderLink = (link: NavLink, compact = false) => {
    const isActive = location.pathname === link.to;
    return (
      <Link
        key={link.to}
        to={link.to}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
          compact && "pl-10",
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <link.icon className="h-4 w-4" />
        <span className="text-sm font-medium">{link.label}</span>
      </Link>
    );
  };

  const renderAdminNav = () => (
    <>
      {/* Dashboard - standalone */}
      <Link
        to="/dashboard"
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
          location.pathname === '/dashboard'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        <span className="text-sm font-medium">Dashboard</span>
      </Link>

      {/* Grouped navigation */}
      {adminGroups.map((group) => {
        const isGroupOpen = openGroups.includes(group.label);
        const hasActiveLink = group.links.some(link => link.to === location.pathname);
        
        return (
          <Collapsible
            key={group.label}
            open={isGroupOpen}
            onOpenChange={() => toggleGroup(group.label)}
          >
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg transition-colors",
                  hasActiveLink 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <group.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{group.label}</span>
                </div>
                {isGroupOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1">
              {group.links.map(link => renderLink(link, true))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </>
  );

  return (
    <>
      {/* Menu Toggle Button - Always Visible */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 bg-card border border-border shadow-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-in fade-in-0 duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">PlagaiScans</span>
          </Link>
          <div className="flex items-center gap-1.5 mt-2 ml-10">
            <span className="text-xs text-muted-foreground">Powered by</span>
            <span className="text-xs font-bold text-[#1f4e79]">turnitin</span>
            <span className="text-[#d9534f] text-xs">®</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {role === 'admin' ? (
            renderAdminNav()
          ) : (
            (role === 'staff' ? staffLinks : customerLinks).map((link) => renderLink(link))
          )}
        </nav>

        <div className="p-4 border-t border-border space-y-4">
          {role === 'customer' && profile && (
            <div className="px-4 py-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Credit Balance</p>
              <p className="text-2xl font-bold text-primary">{profile.credit_balance}</p>
            </div>
          )}
          
          <div className="px-4">
            <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
};
