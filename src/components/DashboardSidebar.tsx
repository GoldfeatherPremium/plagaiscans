import React from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export const DashboardSidebar: React.FC = () => {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();

  const customerLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/dashboard/upload', icon: Upload, label: 'Upload Document' },
    { to: '/dashboard/documents', icon: FileText, label: 'My Documents' },
    { to: '/dashboard/credits', icon: CreditCard, label: 'Buy Credits' },
  ];

  const staffLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/dashboard/queue', icon: FileCheck, label: 'Document Queue' },
    { to: '/dashboard/my-work', icon: FileText, label: 'My Processed' },
    { to: '/dashboard/stats', icon: BarChart3, label: 'My Stats' },
  ];

  const adminLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/dashboard/documents', icon: FileText, label: 'All Documents' },
    { to: '/dashboard/users', icon: Users, label: 'User Management' },
    { to: '/dashboard/credits', icon: CreditCard, label: 'Credit Management' },
    { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  const links = role === 'admin' ? adminLinks : role === 'staff' ? staffLinks : customerLinks;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <FileCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg">DocCheck</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <link.icon className="h-5 w-5" />
              <span className="font-medium">{link.label}</span>
            </Link>
          );
        })}
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
  );
};