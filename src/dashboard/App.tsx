import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { Overview } from './pages/Overview';
import { Websites } from './pages/Websites';
import { WebsiteDetail } from './pages/WebsiteDetail';
import { Sessions } from './pages/Sessions';
import { Settings } from './pages/Settings';
import { useRoute } from './router';
import { useSettings } from './useStats';
import { applyTheme } from '../shared/theme';
import type { RangeId } from './useStats';

export function App() {
  const [route] = useRoute();
  const { data: settings } = useSettings();

  /**
   * The range is owned here rather than by each page, so moving between
   * Overview and Websites keeps the range the user chose.
   */
  const [rangeId, setRangeId] = useState<RangeId>('today');

  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings]);

  return (
    <AppShell route={route}>
      {route.name === 'overview' && <Overview rangeId={rangeId} onRangeChange={setRangeId} />}
      {route.name === 'websites' && <Websites rangeId={rangeId} onRangeChange={setRangeId} />}
      {route.name === 'website' && <WebsiteDetail key={route.domain} domain={route.domain} />}
      {route.name === 'sessions' && <Sessions />}
      {route.name === 'settings' && <Settings />}
    </AppShell>
  );
}
