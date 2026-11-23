// Minimal React hook for a quality control (the tool ring): { setting, tier, name, set(setting) }.
import { useSyncExternalStore } from 'react';
import { quality, onQuality, setQualitySetting, TIERS } from './quality.js';

let snap = { setting: quality.setting, tier: quality.tier };
const subscribe = (l) => onQuality(() => { snap = { setting: quality.setting, tier: quality.tier }; l(); });
const get = () => snap;
export function useQuality() {
  const s = useSyncExternalStore(subscribe, get, get);
  return { setting: s.setting, tier: s.tier, name: TIERS[s.tier].name, set: setQualitySetting };
}
export default useQuality;
