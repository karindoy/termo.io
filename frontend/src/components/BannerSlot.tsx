import type { ActiveBanner, BannerType } from '../hooks/useBanner';

interface BannerSlotProps {
  id?: string;
  /** Transient event banner — animates in on each new key, auto-dismissed by useBanner. */
  banner: ActiveBanner | null;
  /** Persistent state-derived banner — shown when banner is null, no animation. */
  fallback?: { message: string; type: BannerType } | null;
}

export function BannerSlot({ id, banner, fallback }: BannerSlotProps) {
  if (banner) {
    return (
      <div id={id ?? 'banner-slot'} className="banner-slot">
        <p key={banner.key} className={`banner banner-${banner.type} banner-animated`}>
          {banner.message}
        </p>
      </div>
    );
  }

  if (fallback) {
    return (
      <div id={id ?? 'banner-slot'} className="banner-slot">
        <p className={`banner banner-${fallback.type}`}>{fallback.message}</p>
      </div>
    );
  }

  return <div id={id ?? 'banner-slot'} className="banner-slot" />;
}
