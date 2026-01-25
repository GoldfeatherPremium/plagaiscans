import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Mail,
  Shield,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  UserCog,
  PieChart,
  Globe,
  Bell,
  Wrench,
  Search,
  ExternalLink,
  Bot,
  FileStack,
  FileQuestion,
  AlertTriangle,
  RotateCcw,
  Crown,
  CalendarClock,
  Trash2,
  Puzzle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffScanTypes } from '@/hooks/useStaffScanTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

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

interface SeenCounts {
  pendingCrypto: number;
  pendingManualPayments: number;
  openTickets: number;
  pendingDocuments: number;
}

const SEEN_COUNTS_KEY = 'admin-seen-badge-counts';

const getSeenCounts = (): SeenCounts => {
  try {
    const stored = localStorage.getItem(SEEN_COUNTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { pendingCrypto: 0, pendingManualPayments: 0, openTickets: 0, pendingDocuments: 0 };
};

const setSeenCount = (key: keyof SeenCounts, count: number) => {
  const current = getSeenCounts();
  current[key] = count;
  localStorage.setItem(SEEN_COUNTS_KEY, JSON.stringify(current));
};

export const DashboardSidebar: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [previousCounts, setPreviousCounts] = useState<BadgeCounts | null>(null);
  const [animatingBadges, setAnimatingBadges] = useState<Set<string>>(new Set());
  const [seenCounts, setSeenCounts] = useState<SeenCounts>(getSeenCounts);

  // Notification config for each badge type
  const notificationConfig: Record<keyof BadgeCounts, { title: string; description: string; path: string }> = {
    pendingDocuments: {
      title: 'New Document Pending',
      description: 'A new document is waiting in the queue',
      path: '/dashboard/queue',
    },
    pendingManualPayments: {
      title: 'New Manual Payment',
      description: 'A manual payment requires verification',
      path: '/dashboard/manual-payments',
    },
    openTickets: {
      title: 'New Support Ticket',
      description: 'A new support ticket has been opened',
      path: '/dashboard/support-tickets',
    },
    pendingCrypto: {
      title: 'New Crypto Payment',
      description: 'A crypto payment is awaiting confirmation',
      path: '/dashboard/crypto-payments',
    },
  };

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

  // Detect new items, trigger animation and show toast
  useEffect(() => {
    if (!badgeCounts || !previousCounts) {
      if (badgeCounts) setPreviousCounts(badgeCounts);
      return;
    }

    const newAnimating = new Set<string>();
    const notifications: Array<{ key: keyof BadgeCounts; diff: number }> = [];
    
    if (badgeCounts.pendingDocuments > previousCounts.pendingDocuments) {
      newAnimating.add('pendingDocuments');
      notifications.push({ key: 'pendingDocuments', diff: badgeCounts.pendingDocuments - previousCounts.pendingDocuments });
    }
    if (badgeCounts.pendingManualPayments > previousCounts.pendingManualPayments) {
      newAnimating.add('pendingManualPayments');
      notifications.push({ key: 'pendingManualPayments', diff: badgeCounts.pendingManualPayments - previousCounts.pendingManualPayments });
    }
    if (badgeCounts.openTickets > previousCounts.openTickets) {
      newAnimating.add('openTickets');
      notifications.push({ key: 'openTickets', diff: badgeCounts.openTickets - previousCounts.openTickets });
    }
    if (badgeCounts.pendingCrypto > previousCounts.pendingCrypto) {
      newAnimating.add('pendingCrypto');
      notifications.push({ key: 'pendingCrypto', diff: badgeCounts.pendingCrypto - previousCounts.pendingCrypto });
    }

    if (newAnimating.size > 0) {
      setAnimatingBadges(newAnimating);
      setTimeout(() => setAnimatingBadges(new Set()), 3000);
    }

    // Show toast notifications for new items
    notifications.forEach(({ key, diff }) => {
      const config = notificationConfig[key];
      toast({
        title: config.title,
        description: (
          <div className="flex items-center justify-between gap-2">
            <span>{diff > 1 ? `${diff} new items` : config.description}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => navigate(config.path)}
            >
              View <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        ),
      });
    });

    setPreviousCounts(badgeCounts);
  }, [badgeCounts, navigate]);

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

  // Build customerLinks dynamically based on credit balances
  const customerLinks: NavLink[] = useMemo(() => {
    const links: NavLink[] = [
      { to: '/dashboard', icon: LayoutDashboard, label: t('sidebar.dashboard') },
    ];
    
    const hasFullCredits = (profile?.credit_balance || 0) > 0;
    const hasSimilarityCredits = (profile?.similarity_credit_balance || 0) > 0;
    const hasNoCredits = !hasFullCredits && !hasSimilarityCredits;
    
    // Show Full Scan upload if: has full credits OR has no credits at all (so they can see what they need)
    if (hasFullCredits || hasNoCredits) {
      links.push({ to: '/dashboard/upload', icon: Upload, label: t('sidebar.uploadFull') });
    }
    
    // Show Similarity upload if: has similarity credits OR has no credits at all
    if (hasSimilarityCredits || hasNoCredits) {
      links.push({ to: '/dashboard/upload-similarity', icon: FileCheck, label: t('sidebar.uploadSimilarity') });
    }
    
    // Add remaining links
    links.push(
      { to: '/dashboard/documents', icon: FileText, label: t('sidebar.myDocuments') },
      { to: '/dashboard/analytics', icon: PieChart, label: t('sidebar.analytics') },
      { to: '/dashboard/credits', icon: CreditCard, label: t('sidebar.buyCredits') },
      { to: '/dashboard/subscription', icon: Crown, label: t('sidebar.subscription') },
      { to: '/dashboard/payments', icon: Receipt, label: t('sidebar.paymentHistory') },
      { to: '/dashboard/invoices', icon: FileDown, label: t('sidebar.myInvoices') },
      { to: '/dashboard/receipts', icon: Receipt, label: t('sidebar.myReceipts') },
      { to: '/dashboard/profile', icon: User, label: t('sidebar.profile') },
    );
    
    return links;
  }, [profile, t]);

  // Staff scan type access
  const { canAccessAI, canAccessSimilarity } = useStaffScanTypes();

  const staffLinks: NavLink[] = useMemo(() => {
    const links: NavLink[] = [
      { to: '/dashboard', icon: LayoutDashboard, label: t('sidebar.dashboard') },
    ];
    
    if (canAccessAI) {
      links.push(
        { to: '/dashboard/queue', icon: FileCheck, label: t('sidebar.fullScanQueue') },
        { to: '/dashboard/bulk-upload', icon: FileStack, label: 'Bulk Upload (AI)' }
      );
    }
    
    if (canAccessSimilarity) {
      links.push(
        { to: '/dashboard/queue-similarity', icon: FileText, label: t('sidebar.similarityQueue') },
        { to: '/dashboard/similarity-bulk-upload', icon: FileStack, label: 'Bulk Upload (Sim)' }
      );
    }
    
    links.push(
      { to: '/dashboard/my-work', icon: FileText, label: t('sidebar.myProcessed') },
      { to: '/dashboard/stats', icon: BarChart3, label: t('sidebar.myStats') },
      { to: '/dashboard/performance', icon: Activity, label: t('sidebar.performance') },
      { to: '/dashboard/profile', icon: User, label: t('sidebar.profile') }
    );
    
    return links;
  }, [t, canAccessAI, canAccessSimilarity]);

  // Admin grouped navigation
  const adminGroups: NavGroup[] = [
    {
      label: 'Documents',
      icon: FolderOpen,
      badgeKey: 'documents',
      links: [
        { to: '/dashboard/queue', icon: FileCheck, label: 'AI Scan Queue', badgeKey: 'pendingDocuments' },
        { to: '/dashboard/queue-similarity', icon: FileText, label: 'Similarity Queue' },
        { to: '/dashboard/documents', icon: FileText, label: 'All Documents' },
        { to: '/dashboard/magic-links', icon: Upload, label: 'Magic Links' },
        { to: '/dashboard/bulk-upload', icon: FileStack, label: 'Bulk Upload (Full)' },
        { to: '/dashboard/similarity-bulk-upload', icon: FileStack, label: 'Bulk Upload (Similarity)' },
        { to: '/dashboard/unmatched-reports', icon: FileQuestion, label: 'Unmatched Reports' },
        { to: '/dashboard/needs-review', icon: AlertTriangle, label: 'Needs Review' },
        { to: '/dashboard/deleted-documents', icon: Trash2, label: 'Deleted Docs' },
      ],
    },
    {
      label: 'Users & Staff',
      icon: UserCog,
      links: [
        { to: '/dashboard/users', icon: Users, label: 'Users' },
        { to: '/dashboard/credit-validity', icon: CalendarClock, label: 'Credit Expiry' },
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
        { to: '/dashboard/all-payments', icon: DollarSign, label: 'All Payments' },
        { to: '/dashboard/admin-invoices', icon: FileDown, label: 'Invoices' },
        { to: '/dashboard/bank-statements', icon: FileText, label: 'Bank Statements' },
        { to: '/dashboard/pricing', icon: CreditCard, label: 'Pricing' },
        { to: '/dashboard/stripe-payments', icon: CreditCard, label: 'Stripe' },
        { to: '/dashboard/webhook-logs', icon: Activity, label: 'Webhook Logs' },
        { to: '/dashboard/promo-codes', icon: Ticket, label: 'Promo Codes' },
        { to: '/dashboard/promo-analytics', icon: PieChart, label: 'Promo Analytics' },
        { to: '/dashboard/revenue', icon: DollarSign, label: 'Revenue' },
        { to: '/dashboard/crypto-payments', icon: CreditCard, label: 'Crypto', badgeKey: 'pendingCrypto' },
        { to: '/dashboard/manual-payments', icon: Wallet, label: 'Manual', badgeKey: 'pendingManualPayments' },
      ],
    },
    {
      label: 'Analytics',
      icon: PieChart,
      links: [
        { to: '/dashboard/overview', icon: LayoutDashboard, label: 'Overview' },
        { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/dashboard/activity-logs', icon: Activity, label: 'Activity Logs' },
        { to: '/dashboard/system-health', icon: Server, label: 'System Health' },
        { to: '/dashboard/reports', icon: FileDown, label: 'Reports' },
        { to: '/dashboard/performance', icon: Activity, label: 'Staff Performance' },
      ],
    },
    {
      label: 'Communication',
      icon: Bell,
      badgeKey: 'communication',
      links: [
        { to: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
        { to: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
        { to: '/dashboard/emails', icon: Mail, label: 'Email Center' },
        { to: '/dashboard/email-logs', icon: Mail, label: 'Email Logs' },
        { to: '/dashboard/support-tickets', icon: MessageSquare, label: 'Support', badgeKey: 'openTickets' },
        { to: '/dashboard/refund-requests', icon: RotateCcw, label: 'Refunds' },
      ],
    },
    {
      label: 'Settings',
      icon: Wrench,
      links: [
        { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
        { to: '/dashboard/site-content', icon: FileText, label: 'Site Content' },
        { to: '/dashboard/ai-helper', icon: Bot, label: 'AI Helper' },
        { to: '/dashboard/extension-download', icon: Puzzle, label: 'Extension' },
        { to: '/dashboard/profile', icon: User, label: 'Profile' },
      ],
    },
  ];

  // Calculate unseen count (only show badge for new items since last visit)
  const getUnseenCount = useCallback((key: keyof BadgeCounts): number => {
    if (!badgeCounts) return 0;
    const currentCount = badgeCounts[key];
    const seen = seenCounts[key as keyof SeenCounts] || 0;
    // Show badge only if current count is greater than what was seen
    return currentCount > seen ? currentCount - seen : 0;
  }, [badgeCounts, seenCounts]);

  // Calculate group badge counts (using unseen counts)
  const getGroupBadgeCount = (group: NavGroup): number => {
    if (!badgeCounts) return 0;
    return group.links.reduce((total, link) => {
      if (link.badgeKey) {
        return total + getUnseenCount(link.badgeKey as keyof BadgeCounts);
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

  // Close sidebar when route changes and mark items as seen
  useEffect(() => {
    setIsOpen(false);
    setSearchQuery('');
    
    // Mark badges as "seen" when visiting their respective pages
    if (badgeCounts) {
      const pathToKey: Record<string, keyof SeenCounts> = {
        '/dashboard/crypto-payments': 'pendingCrypto',
        '/dashboard/manual-payments': 'pendingManualPayments',
        '/dashboard/support-tickets': 'openTickets',
        '/dashboard/queue': 'pendingDocuments',
      };
      
      const seenKey = pathToKey[location.pathname];
      if (seenKey && badgeCounts[seenKey] > 0) {
        setSeenCount(seenKey, badgeCounts[seenKey]);
        setSeenCounts(getSeenCounts());
      }
    }
  }, [location.pathname, badgeCounts]);


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
    const badgeCount = link.badgeKey ? getUnseenCount(link.badgeKey as keyof BadgeCounts) : 0;
    
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
            <div className="px-4 py-3 bg-muted rounded-lg space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">{t('sidebar.fullScanCredits')}</p>
                <p className="text-xl font-bold text-primary">{profile.credit_balance}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('sidebar.similarityCredits')}</p>
                <p className="text-xl font-bold text-secondary">{profile.similarity_credit_balance || 0}</p>
              </div>
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
            {t('sidebar.signOut')}
          </Button>
        </div>
      </aside>
    </>
  );
};