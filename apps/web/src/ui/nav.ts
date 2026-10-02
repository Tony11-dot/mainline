import { BookOpen, Compass, Home, Settings, Swords, type LucideIcon } from 'lucide-react';
import { msg } from '../lib/i18n';

export interface NavItem {
  to: string;
  /** English; shown through t(). */
  label: string;
  icon: LucideIcon;
  /** SF Symbol name used by the native iOS tab bar. */
  sfSymbol: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: msg('Today'), icon: Home, sfSymbol: 'house' },
  { to: '/library', label: msg('Repertoire'), icon: BookOpen, sfSymbol: 'books.vertical' },
  { to: '/explore', label: msg('Explore'), icon: Compass, sfSymbol: 'safari' },
  { to: '/games', label: msg('Games'), icon: Swords, sfSymbol: 'trophy' },
  { to: '/settings', label: msg('Settings'), icon: Settings, sfSymbol: 'gearshape' },
];
