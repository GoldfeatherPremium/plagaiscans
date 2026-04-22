/**
 * NoScriptFallback
 * -----------------
 * Renders a hidden block of plain HTML that becomes visible to:
 *   - Search engine crawlers that don't execute JavaScript
 *   - Social media scrapers
 *   - Visitors with JavaScript disabled
 *
 * The block is wrapped in <noscript>, so JS-enabled visitors never see it.
 * Each public page passes its own page-specific content via children, plus
 * a shared site footer with links to all major public pages so crawlers can
 * traverse the full site graph even without JS.
 */

import React from 'react';

const PUBLIC_LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about-us', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
  { href: '/academic-integrity', label: 'Academic Integrity' },
  { href: '/terms-and-conditions', label: 'Terms of Service' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/refund-policy', label: 'Refund Policy' },
];

interface NoScriptFallbackProps {
  /** Page-specific h1 title for the no-JS / crawler view. */
  title: string;
  /** Plain-text intro paragraph(s). */
  intro?: string;
  /** Optional additional content nodes (lists, paragraphs). */
  children?: React.ReactNode;
}

export function NoScriptFallback({ title, intro, children }: NoScriptFallbackProps) {
  return (
    <noscript>
      {/* Inline styles only — no Tailwind, since this must work without JS/CSS bundles. */}
      <div
        style={{
          maxWidth: 880,
          margin: '0 auto',
          padding: '24px 16px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: '#0f172a',
          lineHeight: 1.6,
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <a href="/" style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>
            Plagaiscans
          </a>
          <span style={{ color: '#64748b' }}> — Plagiarism Checker &amp; AI Content Detection</span>
        </header>

        <main>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>{title}</h1>
          {intro && <p style={{ marginBottom: 16 }}>{intro}</p>}
          {children}
        </main>

        <footer style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #e2e8f0', fontSize: 14 }}>
          <p style={{ marginBottom: 12, fontWeight: 600 }}>Browse Plagaiscans</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {PUBLIC_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 16, color: '#64748b' }}>
            Plagaiscans Technologies Ltd · United Kingdom · Company No. 16998013 ·{' '}
            <a href="mailto:support@plagaiscans.com" style={{ color: '#2563eb' }}>
              support@plagaiscans.com
            </a>
          </p>
          <p style={{ marginTop: 8, color: '#64748b' }}>
            This page works best with JavaScript enabled. Please enable JavaScript in your browser
            for the full interactive experience.
          </p>
        </footer>
      </div>
    </noscript>
  );
}

export default NoScriptFallback;
