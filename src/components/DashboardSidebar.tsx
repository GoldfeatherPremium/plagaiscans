import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface NavLink {
  to: string;
  icon: React.ElementType;
  label: string;
  badgeKey?: string;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  links: NavLink[];
  badgeKey?: string;
}

interface BadgeCounts {
  pendingDocuments: number;
  pendingManualPayments: number;
  openTickets: number;
  pendingCrypto: number;
}

export const DashboardSidebar: React.FC = () => {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [previousCounts, setPreviousCounts] = useState<BadgeCounts | null>(null);
  const [animatingBadges, setAnimatingBadges] = useState<Set<string>>(new Set());

  // Fetch badge counts for admin
  const { data: badgeCounts } = useQuery({
    queryKey: ['admin-badge-counts'],
    queryFn: async (): Promise<BadgeCounts> => {
      const [documentsRes, manualPaymentsRes, ticketsRes, cryptoRes] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('manual_payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('crypto_payments').select('id', { count: 'exact', head: true }).eq('status', 'waiting'),
      ]);
      
      return {
        pendingDocuments: documentsRes.count || 0,
        pendingManualPayments: manualPaymentsRes.count || 0,
        openTickets: ticketsRes.count || 0,
        pendingCrypto: cryptoRes.count || 0,
      };
    },
    enabled: role === 'admin',
    refetchInterval: 30000,
  });

  // Detect new items and trigger animation
  useEffect(() => {
    if (!badgeCounts || !previousCounts) {
      if (badgeCounts) setPreviousCounts(badgeCounts);
      return;
    }

    const newAnimating = new Set<string>();
    
    if (badgeCounts.pendingDocuments > previousCounts.pendingDocuments) {
      newAnimating.add('pendingDocuments');
    }
    if (badgeCounts.pendingManualPayments > previousCounts.pendingManualPayments) {
      newAnimating.add('pendingManualPayments');
    }
    if (badgeCounts.openTickets > previousCounts.openTickets) {
      newAnimating.add('openTickets');
    }
    if (badgeCounts.pendingCrypto > previousCounts.pendingCrypto) {
      newAnimating.add('pendingCrypto');
    }

    if (newAnimating.size > 0) {
      setAnimatingBadges(newAnimating);
      // Clear animation after it completes (3 pulses × 1s = 3s)
      setTimeout(() => setAnimatingBadges(new Set()), 3000);
    }

    setPreviousCounts(badgeCounts);
  }, [badgeCounts]);

  // Real-time subscriptions for badge updates
  useEffect(() => {
    if (role !== 'admin') return;

    const channels = [
      supabase
        .channel('documents-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-badge-counts'] });
        })
        .subscribe(),
      supabase
        .channel('manual-payments-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_payments' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-badge-counts'] });
        })
        .subscribe(),
      supabase
        .channel('support-tickets-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-badge-counts'] });
        })
        .subscribe(),
      supabase
        .channel('crypto-payments-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crypto_payments' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-badge-counts'] });
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [role, queryClient]);

  // Keyboard shortcuts (Cmd/Ctrl + K for search, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
      
      // Escape to close sidebar or clear search
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

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
      badgeKey: 'documents',
      links: [
        { to: '/dashboard/queue', icon: FileCheck, label: 'Queue', badgeKey: 'pendingDocuments' },
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
      badgeKey: 'payments',
      links: [
        { to: '/dashboard/pricing', icon: CreditCard, label: 'Pricing' },
        { to: '/dashboard/promo-codes', icon: Ticket, label: 'Promo Codes' },
        { to: '/dashboard/revenue', icon: DollarSign, label: 'Revenue' },
        { to: '/dashboard/crypto-payments', icon: CreditCard, label: 'Crypto', badgeKey: 'pendingCrypto' },
        { to: '/dashboard/manual-payments', icon: Wallet, label: 'Manual', badgeKey: 'pendingManualPayments' },
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
      badgeKey: 'communication',
      links: [
        { to: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
        { to: '/dashboard/support-tickets', icon: MessageSquare, label: 'Support', badgeKey: 'openTickets' },
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

  // Calculate group badge counts
  const getGroupBadgeCount = (group: NavGroup): number => {
    if (!badgeCounts) return 0;
    return group.links.reduce((total, link) => {
      if (link.badgeKey && badgeCounts[link.badgeKey as keyof BadgeCounts]) {
        return total + badgeCounts[link.badgeKey as keyof BadgeCounts];
      }
      return total;
    }, 0);
  };

  // Filter links based on search
  const filteredAdminGroups = useMemo(() => {
    if (!searchQuery.trim()) return adminGroups;
    
    const query = searchQuery.toLowerCase();
    return adminGroups
      .map(group => ({
        ...group,
        links: group.links.filter(link => 
          link.label.toLowerCase().includes(query)
        ),
      }))
      .filter(group => group.links.length > 0 || group.label.toLowerCase().includes(query));
  }, [searchQuery]);

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

  // Auto-expand all groups when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setOpenGroups(filteredAdminGroups.map(g => g.label));
    }
  }, [searchQuery, filteredAdminGroups]);

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, [location.pathname]);

  const renderBadge = (count: number, badgeKey?: string) => {
    if (count === 0) return null;
    const isAnimating = badgeKey && animatingBadges.has(badgeKey);
    return (
      <Badge 
        variant="destructive" 
        className={cn(
          "h-5 min-w-5 px-1.5 text-xs font-medium",
          isAnimating && "animate-badge-pulse"
        )}
      >
        {count > 99 ? '99+' : count}
      </Badge>
    );
  };

  const renderLink = (link: NavLink, compact = false) => {
    const isActive = location.pathname === link.to;
    const badgeCount = link.badgeKey && badgeCounts ? badgeCounts[link.badgeKey as keyof BadgeCounts] : 0;
    
    return (
      <Link
        key={link.to}
        to={link.to}
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg transition-colors",
          compact && "pl-10",
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <div className="flex items-center gap-3">
          <link.icon className="h-4 w-4" />
          <span className="text-sm font-medium">{link.label}</span>
        </div>
        {badgeCount > 0 && !isActive && renderBadge(badgeCount, link.badgeKey)}
      </Link>
    );
  };

  const renderAdminNav = () => (
    <>
      {/* Search Box */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Search... (⌘K)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-8 h-9 text-sm bg-muted/50"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 flex items-center justify-center transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dashboard - standalone */}
      {(!searchQuery.trim() || 'dashboard'.includes(searchQuery.toLowerCase())) && (
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
      )}

      {/* Grouped navigation */}
      {filteredAdminGroups.map((group) => {
        const isGroupOpen = openGroups.includes(group.label);
        const hasActiveLink = group.links.some(link => link.to === location.pathname);
        const groupBadgeCount = getGroupBadgeCount(group);
        
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
                <div className="flex items-center gap-2">
                  {!isGroupOpen && groupBadgeCount > 0 && renderBadge(groupBadgeCount, group.badgeKey)}
                  {isGroupOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1">
              {group.links.map(link => renderLink(link, true))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* No results */}
      {searchQuery.trim() && filteredAdminGroups.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No menu items found</p>
      )}
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