/** Small inline icon set (stroke icons, 24×24) so no icon library is needed. */
type IconProps = { className?: string };

function Icon({ className = "size-6", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);
export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
    <path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5" />
  </Icon>
);
export const ScanIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7V4a1 1 0 0 1 1-1h3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M7 21H4a1 1 0 0 1-1-1v-3" />
    <path d="M7 12h10" />
  </Icon>
);
export const ClipboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="4" width="14" height="18" rx="2" />
    <path d="M9 2h6v4H9zM9 12l2 2 4-4" />
  </Icon>
);
export const FileIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Icon>
);
