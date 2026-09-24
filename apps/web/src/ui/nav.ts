import { BookOpen, Compass, Home, Settings, Swords, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** SF Symbol name used by the native iOS tab bar. */
  sfSymbol: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Home, sfSymbol: 'house' },
  { to: '/library', label: 'Repertoire', icon: BookOpen, sfSymbol: 'books.vertical' },
  { to: '/explore', label: 'Explore', icon: Compass, sfSymbol: 'safari' },
  { to: '/games', label: 'Games', icon: Swords, sfSymbol: 'figure.fencing' },
  { to: '/settings', label: 'Settings', icon: Settings, sfSymbol: 'gearshape' },
];
