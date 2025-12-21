import React, { useEffect, useState } from 'react';
import { Moon, Sun, Coins, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';

export const DashboardHeader: React.FC = () => {
  const { user, profile, role } = useAuth();
  const { getCartCount } = useCart();
  const navigate = useNavigate();
  const cartCount = getCartCount();
  
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    // Check for saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Left side - Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">P</span>
            </div>
            <span className="font-display font-semibold text-lg hidden sm:block">PlagiScans</span>
          </div>
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Credit Balance for customers */}
          {role === 'customer' && profile && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">{profile.credit_balance}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">credits</span>
            </div>
          )}

          {/* Cart Icon for customers */}
          {role === 'customer' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/credits')}
              className="rounded-full hover:bg-muted relative"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Button>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full hover:bg-muted"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-accent" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Notification Bell */}
          {user && <NotificationBell />}
        </div>
      </div>
    </header>
  );
};
