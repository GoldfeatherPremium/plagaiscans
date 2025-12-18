import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, CreditCard, CheckCircle } from 'lucide-react';

export default function BuyCredits() {
  const { profile } = useAuth();
  const { openWhatsApp } = useWhatsApp();

  const plans = [
    { credits: 10, price: 15 },
    { credits: 25, price: 30 },
    { credits: 50, price: 50 },
    { credits: 100, price: 90 },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Buy Credits</h1>
          <p className="text-muted-foreground mt-1">
            Purchase credits to check your documents
          </p>
        </div>

        {/* Current Balance */}
        <Card className="gradient-primary text-primary-foreground">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                <CreditCard className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm opacity-80">Current Balance</p>
                <p className="text-3xl font-bold">{profile?.credit_balance || 0} Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <Card key={plan.credits} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">{plan.credits} Credits</h3>
                    <p className="text-sm text-muted-foreground">
                      ${(plan.price / plan.credits).toFixed(2)} per document
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-primary">${plan.price}</p>
                </div>
                <ul className="space-y-2 mb-4 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    Similarity Detection
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    AI Content Detection
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    Detailed PDF Reports
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    Credits Never Expire
                  </li>
                </ul>
                <Button
                  className="w-full bg-[#25D366] hover:bg-[#128C7E]"
                  onClick={() => openWhatsApp(plan.credits)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Buy via WhatsApp
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How to Purchase Credits</CardTitle>
            <CardDescription>
              Follow these simple steps to add credits to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Click "Buy via WhatsApp"</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose your desired credit package and click the button
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Complete Payment</h4>
                  <p className="text-sm text-muted-foreground">
                    Follow the payment instructions provided by our team
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Credits Added</h4>
                  <p className="text-sm text-muted-foreground">
                    Once payment is confirmed, credits will be added to your account
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}