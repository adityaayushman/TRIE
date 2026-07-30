/** Shared line-icon set for the dashboard nav and page headers, so both draw
 * from one source. Keyed by section. */

export type IconName =
  | "overview"
  | "live"
  | "vehicles"
  | "traffic"
  | "history"
  | "blackspots"
  | "settings";

type IconProps = { className?: string; size?: number };

export const ICONS: Record<IconName, (props: IconProps) => JSX.Element> = {
  overview: ({ className, size = 15 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <rect x="2" y="2" width="5" height="5" rx="1" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" strokeWidth="1.4" />
    </svg>
  ),
  live: ({ className, size = 15 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M1.5 8.5h3l1.5-5 3 9 1.5-4h4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  vehicles: ({ className, size = 15 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M2 10V8.2a1 1 0 01.55-.9l1.2-.6L4.8 4h6.4l1.05 2.7 1.2.6a1 1 0 01.55.9V10" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2 10h12v1.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V11h-8v.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V10z" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="4.5" cy="10" r="1" strokeWidth="1.1" />
      <circle cx="11.5" cy="10" r="1" strokeWidth="1.1" />
    </svg>
  ),
  traffic: ({ className, size = 15 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M3 13V6M8 13V3M13 13v8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  history: ({ className, size = 15 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <circle cx="8" cy="8" r="6" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.5 1.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  blackspots: ({ className, size = 15 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M8 14s5-4.2 5-8a5 5 0 00-10 0c0 3.8 5 8 5 8z" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="6" r="1.6" strokeWidth="1.3" />
    </svg>
  ),
  settings: ({ className, size = 15 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <circle cx="8" cy="8" r="2.2" strokeWidth="1.4" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.1 3.9l-1.1 1.1M5 11l-1.1 1.1M12.1 12.1L11 11M5 5 3.9 3.9" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
};
