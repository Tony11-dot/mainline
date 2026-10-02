import { msg, t } from './i18n';

const SPEED_NAMES: Record<string, string> = {
  ultraBullet: msg('UltraBullet'),
  bullet: msg('Bullet'),
  blitz: msg('Blitz'),
  rapid: msg('Rapid'),
  classical: msg('Classical'),
  correspondence: msg('Correspondence'),
  daily: msg('Daily'),
};

/** A time control ("blitz") in the app language. */
export const speedName = (speed: string) => (SPEED_NAMES[speed] ? t(SPEED_NAMES[speed]) : speed);
