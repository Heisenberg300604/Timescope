import { useState } from 'react';
import { faviconUrl, monogramSlot } from '../favicon';
import { domainLabel } from '../../categories/resolver';

interface FaviconProps {
  domain: string;
  size?: number;
  className?: string;
}

/**
 * A site's icon, falling back to a monogram tile when the browser has no
 * cached favicon (common for a site visited once, or in a fresh profile).
 * Always decorative: every usage sits beside the site name in text.
 */
export function Favicon({ domain, size = 20, className = '' }: FaviconProps) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : faviconUrl(domain, size <= 16 ? 16 : 32);

  if (!src) {
    const slot = monogramSlot(domain, 9);
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded font-medium text-white ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.5),
          background: `var(--cat-${slot})`,
        }}
      >
        {domainLabel(domain).charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[3px] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
