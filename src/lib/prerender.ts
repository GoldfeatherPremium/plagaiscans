export const PRERENDER_READY_EVENT = 'plagaiscans:prerender-ready';

export const PRERENDER_ROUTES = [
  '/',
  '/pricing',
  '/about',
  '/about-us',
  '/contact',
  '/terms',
  '/terms-and-conditions',
  '/privacy',
  '/privacy-policy',
  '/refund',
  '/refund-policy',
  '/acceptable-use',
  '/academic-integrity',
  '/auth',
] as const;

export interface PublicPricingPackageSnapshot {
  id: string;
  name: string;
  credits: number;
  price: number;
  package_type: string;
  billing_interval: string | null;
  validity_days: number | null;
  description: string | null;
  features: string[];
  is_most_popular?: boolean;
}

export const PUBLIC_PRICING_PACKAGES: PublicPricingPackageSnapshot[] = [
  {
    id: 'public-pack-1',
    name: '1 Credit Pack',
    credits: 1,
    price: 3.99,
    package_type: 'time_limited',
    billing_interval: null,
    validity_days: null,
    description: 'One document check with AI and similarity reports.',
    features: [
      'Turnitin AI Report',
      'Turnitin Similarity Report',
      'Non Repository',
      'Fast Processing',
      '24/7 Support',
    ],
  },
  {
    id: 'public-pack-10',
    name: '10 Credits Pack',
    credits: 10,
    price: 29.99,
    package_type: 'time_limited',
    billing_interval: null,
    validity_days: null,
    description: 'Best for regular student and researcher submissions.',
    features: [
      'Turnitin AI Report',
      'Turnitin Similarity Report',
      'Non Repository',
      'Fast Processing',
      '24/7 Support',
    ],
  },
  {
    id: 'public-pack-30',
    name: '30 Credits Pack',
    credits: 30,
    price: 79.99,
    package_type: 'time_limited',
    billing_interval: null,
    validity_days: null,
    description: 'Lower per-report pricing for higher-volume usage.',
    features: [
      'Turnitin AI Report',
      'Turnitin Similarity Report',
      'Non Repository',
      'Fast Processing',
      '24/7 Support',
    ],
  },
  {
    id: 'public-pack-100',
    name: '100 Credits Pack',
    credits: 100,
    price: 199,
    package_type: 'time_limited',
    billing_interval: null,
    validity_days: null,
    description: 'High-volume plan for institutions and large teams.',
    features: [
      'Turnitin AI Report',
      'Turnitin Similarity Report',
      'Non Repository',
      'Fast Processing',
      '24/7 Support',
    ],
    is_most_popular: true,
  },
];

export function signalPrerenderReady() {
  const globalRef = globalThis as any;
  const dispatchReady = () => {
    if (typeof globalRef?.document?.dispatchEvent === 'function' && typeof globalRef?.Event === 'function') {
      globalRef.document.dispatchEvent(new globalRef.Event(PRERENDER_READY_EVENT));
    }
  };

  if (!globalRef?.document) return;

  if (typeof globalRef.requestAnimationFrame === 'function') {
    globalRef.requestAnimationFrame(() => {
      if (typeof globalRef.setTimeout === 'function') {
        globalRef.setTimeout(dispatchReady, 0);
        return;
      }

      dispatchReady();
    });

    return;
  }

  if (typeof globalRef.setTimeout === 'function') {
    globalRef.setTimeout(dispatchReady, 0);
    return;
  }

  dispatchReady();
}