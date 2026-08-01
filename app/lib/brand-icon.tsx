// Shared visual for the app icon / apple-touch-icon: an abstract therapy
// armchair whose backrest doubles as the letter "T" — rendered via next/og's
// ImageResponse (Satori), so no external image tooling or binary assets are needed.
export function ChairMonogramSvg() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      {/* seat + armrests — the "chair" */}
      <rect x="8" y="27" width="9" height="21" rx="4" fill="#fdf8f2" fillOpacity="0.92" />
      <rect x="47" y="27" width="9" height="21" rx="4" fill="#fdf8f2" fillOpacity="0.92" />
      <rect x="14" y="39" width="36" height="11" rx="4" fill="#fdf8f2" />
      <rect x="16" y="49" width="5" height="8" rx="1.5" fill="#fdf8f2" fillOpacity="0.75" />
      <rect x="43" y="49" width="5" height="8" rx="1.5" fill="#fdf8f2" fillOpacity="0.75" />
      {/* backrest top-bar + stem — reads as the letter T */}
      <rect x="10" y="9" width="44" height="10" rx="5" fill="#e8b978" />
      <rect x="26.5" y="9" width="11" height="33" rx="4" fill="#e8b978" />
    </svg>
  );
}
