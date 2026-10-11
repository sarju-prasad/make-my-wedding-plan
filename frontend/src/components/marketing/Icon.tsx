/** Material Symbols Outlined icon, loaded via the stylesheet link in layout.tsx. */
export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}
