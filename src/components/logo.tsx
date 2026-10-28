/** Hexagon (honeycomb cell) mark with "LL", in bumblebee yellow and black. */
export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 1.5 29 9v14l-13 7.5L3 23V9z" className="fill-primary" />
      <path d="M8.5 9.5H11v10h4v2.5H8.5zM16.5 9.5H19v10h4.5v2.5h-7z" className="fill-primary-content" />
    </svg>
  );
}
