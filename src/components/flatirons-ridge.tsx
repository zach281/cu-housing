// The Flatirons as seen from campus: tilted sandstone slabs leaning against
// Green Mountain. Decorative only.
export function FlatironsRidge({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className={className}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* Green Mountain behind the slabs */}
      <path
        d="M0 200 L0 150 C 140 128, 250 92, 380 70 C 520 48, 640 44, 760 62 C 900 84, 1040 120, 1200 136 L1200 200 Z"
        className="fill-pine-wash"
      />
      <path
        d="M0 150 C 140 128, 250 92, 380 70 C 520 48, 640 44, 760 62 C 900 84, 1040 120, 1200 136"
        fill="none"
        className="stroke-pine"
        strokeWidth="1.25"
        opacity=".35"
      />
      {/* Slabs: steep north edge, long dip slope, flat base. Third → First. */}
      <g className="fill-paper stroke-pine" strokeWidth="2">
        <path d="M330 200 L392 118 L404 116 L470 200 Z" />
        <path d="M450 200 L536 86 L552 84 L640 200 Z" />
        <path d="M600 200 L704 56 L722 54 L826 200 Z" />
        <path d="M800 200 L866 112 L878 112 L940 200 Z" />
      </g>
      {/* Bedding lines on the slab faces */}
      <g fill="none" className="stroke-pine" strokeWidth="1.25" opacity=".45">
        <path d="M410 140 L436 176" />
        <path d="M560 112 L590 152 M574 168 L586 186" />
        <path d="M730 84 L768 136 M752 150 L782 192" />
        <path d="M884 136 L906 168" />
      </g>
      {/* Foothills in front */}
      <path d="M0 200 L0 186 C 200 178, 420 194, 640 186 S 1000 176, 1200 188 L1200 200 Z" className="fill-paper" />
      <path
        d="M0 186 C 200 178, 420 194, 640 186 S 1000 176, 1200 188"
        fill="none"
        className="stroke-pine"
        strokeWidth="1.5"
        opacity=".5"
      />
    </svg>
  );
}
