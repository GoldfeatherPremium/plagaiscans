/// <reference types="vite/client" />

interface PushManagerExtended {
  getSubscription(): Promise<PushSubscription | null>;
  subscribe(options?: PushSubscriptionOptionsInit): Promise<PushSubscription>;
}

interface ServiceWorkerRegistration {
  readonly pushManager: PushManagerExtended;
}

