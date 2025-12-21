import React, { createContext, useContext, useState, useEffect } from 'react';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
}

interface CartItem {
  package: PricingPackage;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (plan: PricingPackage) => void;
  updateCartQuantity: (packageId: string, delta: number) => void;
  removeFromCart: (packageId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCredits: () => number;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (plan: PricingPackage) => {
    setCart(prev => {
      const existing = prev.find(item => item.package.id === plan.id);
      if (existing) {
        return prev.map(item => 
          item.package.id === plan.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { package: plan, quantity: 1 }];
    });
  };

  const updateCartQuantity = (packageId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.package.id === packageId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (packageId: string) => {
    setCart(prev => prev.filter(item => item.package.id !== packageId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.package.price * item.quantity), 0);
  };

  const getCartCredits = () => {
    return cart.reduce((sum, item) => sum + (item.package.credits * item.quantity), 0);
  };

  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      getCartTotal,
      getCartCredits,
      getCartCount,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
