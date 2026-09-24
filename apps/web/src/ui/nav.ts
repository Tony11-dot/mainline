import { BookOpen, Compass, Home, Settings, Swords, type LucideIcon } from 'lucide-react';

import type { MsgKey } from '../lib/i18n';

export interface NavItem {
  to: string;
  label: string;
  key: MsgKey;
  icon: LucideIcon;
  /** SF Symbol name used by the native iOS tab bar. */
  sfSymbol: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Today', key: 'nav.today', icon: Home, sfSymbol: 'house' },
  { to: '/library', label: 'Repertoire', key: 'nav.repertoire', icon: BookOpen, sfSymbol: 'books.vertical' },
  { to: '/explore', label: 'Explore', key: 'nav.explore', icon: Compass, sfSymbol: 'safari' },
  { to: '/games', label: 'Games', key: 'nav.games', icon: Swords, sfSymbol: 'trophy' },
  { to: '/settings', label: 'Settings', key: 'nav.settings', icon: Settings, sfSymbol: 'gearshape' },
];
