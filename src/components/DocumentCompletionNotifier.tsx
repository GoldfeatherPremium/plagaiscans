import { useDocumentCompletionNotifications } from '@/hooks/useDocumentCompletionNotifications';

/**
 * Component that initializes document completion notifications.
 * Should be placed inside AuthProvider to have access to user context.
 */
export const DocumentCompletionNotifier: React.FC = () => {
  useDocumentCompletionNotifications();
  return null;
};
