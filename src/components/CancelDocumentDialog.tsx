import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CreditCard, User, FileText } from 'lucide-react';

interface CancelDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    file_name: string;
    user_id: string | null;
    magic_link_id?: string | null;
    scan_type: 'full' | 'similarity_only';
    customer_profile?: {
      email: string;
      full_name: string | null;
    } | null;
    profile?: {
      email: string;
      full_name: string | null;
    } | null;
  } | null;
  onConfirm: (reason: string) => Promise<void>;
  cancelling: boolean;
}

export const CancelDocumentDialog: React.FC<CancelDocumentDialogProps> = ({
  open,
  onOpenChange,
  document,
  onConfirm,
  cancelling,
}) => {
  const [reason, setReason] = useState('');

  if (!document) return null;

  const isGuestUpload = !!document.magic_link_id;
  const customerInfo = document.customer_profile || document.profile;
  const creditType = document.scan_type === 'full' ? 'AI Scan Credit' : 'Similarity Credit';

  const handleConfirm = async () => {
    await onConfirm(reason);
    setReason('');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Document
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                This action will permanently cancel this document and refund the credit to the customer.
              </p>
              
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Document</p>
                    <p className="text-sm text-muted-foreground truncate">{document.file_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Customer</p>
                    <p className="text-sm text-muted-foreground">
                      {isGuestUpload ? (
                        <Badge variant="outline" className="text-xs">Guest Upload</Badge>
                      ) : customerInfo ? (
                        customerInfo.full_name || customerInfo.email
                      ) : (
                        'Unknown'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Credit Refund</p>
                    <p className="text-sm text-muted-foreground">
                      {isGuestUpload ? (
                        '1 upload slot will be restored'
                      ) : (
                        `1 ${creditType} will be refunded`
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Cancellation Reason (Optional)</Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="Enter reason for cancellation..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelling}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={cancelling}
          >
            {cancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
