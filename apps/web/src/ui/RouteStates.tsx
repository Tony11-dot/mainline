import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Compass, RotateCw, TriangleAlert } from 'lucide-react';
import { EmptyState } from './kit';
import { Button, Skeleton } from './primitives';
import { t } from '../lib/i18n';

/** An address the app doesn't know, or a screen that failed to render: say so in the app's own voice, with a way home. */
export function RouteError() {
  const err = useRouteError();
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  if (import.meta.env.DEV && !notFound) console.error(err);
  return (
    <div className="mx-auto max-w-md px-4 py-16 md:py-24">
      <EmptyState
        icon={notFound ? Compass : TriangleAlert}
        title={notFound ? t('Page not found') : t('Something went wrong')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/" className="pressable inline-flex h-11 items-center rounded-[var(--radius-control)] bg-brand px-4 font-semibold text-on-brand">
              {t('Back to Today')}
            </Link>
            {!notFound && (
              <Button icon={RotateCw} onClick={() => location.reload()}>
                {t('Reload')}
              </Button>
            )}
          </div>
        }
      >
        {notFound ? t('There’s nothing at this address.') : t('Reload the app and try again. Your repertoire and training are saved.')}
      </EmptyState>
    </div>
  );
}

/** The page's shape while a screen's code loads: a title and a few cards, nothing that jumps. */
export function RouteLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10" aria-busy="true" aria-label={t('Loading…')}>
      <Skeleton className="h-10 w-40 rounded-[var(--radius-s)]" />
      <Skeleton className="mt-6 h-24 rounded-[var(--radius-l)]" />
      <Skeleton className="mt-3 h-16 rounded-[var(--radius-l)]" />
      <Skeleton className="mt-9 h-6 w-28 rounded-[var(--radius-xs)]" />
      <Skeleton className="mt-3 h-48 rounded-[var(--radius-l)]" />
    </div>
  );
}
