import { useId } from 'react';

/**
 * Keep the original Kampus artwork, but key out its baked-in dark-green
 * backdrop so it sits naturally on both midnight and lighter surfaces.
 *
 * A green pixel has G >= R, while the gold tree has R > G. The color matrix
 * uses that difference for alpha instead of changing the artwork's colors.
 * The source PNG is deliberately retained for existing app icons and metadata.
 */
export default function KampusLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  const filterId = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 332 390"
      width="332"
      height="390"
      role="img"
      aria-label="Kampus"
      focusable="false"
      className={`${className} block shrink-0 align-middle`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id={filterId} colorInterpolationFilters="sRGB" x="-10%" y="-10%" width="120%" height="120%">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  10 -10 0 0 0"
          />
        </filter>
      </defs>
      <image
        href="/images/ClipSnap_20260723201232.png"
        x="0"
        y="0"
        width="332"
        height="390"
        preserveAspectRatio="xMidYMid meet"
        filter={`url(#${filterId})`}
      />
    </svg>
  );
}
