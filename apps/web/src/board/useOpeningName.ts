import { useEffect, useState } from 'react';
import { openingForLine, openingIndex, type OpeningInfo } from '../lib/openings';

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

/** Opening names by position (EPD), once the bundled table has loaded. */
export function useOpeningsByEpd() {
  const [byEpd, setByEpd] = useState<Map<string, OpeningInfo>>();
  useEffect(() => {
    let live = true;
    void openingIndex().then((i) => live && setByEpd(i.byEpd));
    return () => {
      live = false;
    };
  }, []);
  return byEpd;
}
