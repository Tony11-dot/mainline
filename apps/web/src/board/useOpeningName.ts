import { useEffect, useState } from 'react';
import { openingForLine, type OpeningInfo } from '../lib/openings';

export function useOpeningName(fens: string[]) {
  const key = fens.join('|');
  const [opening, setOpening] = useState<OpeningInfo | undefined>();
  useEffect(() => {
    let live = true;
    void openingForLine(fens).then((o) => live && setOpening(o));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return opening;
}
