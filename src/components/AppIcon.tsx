import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName = 'plus' | 'search' | 'chevron' | 'down' | 'close' | 'invoice' | 'reports' | 'settings';

/** A single stroke weight and 24px grid for navigation and everyday actions. */
export default function AppIcon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
    {name === 'search' && <><Circle cx="10.5" cy="10.5" r="6.5" /><Path d="m16 16 4.5 4.5" /></>}
    {name === 'chevron' && <Path d="m9 5 7 7-7 7" />}
    {name === 'down' && <Path d="m6 9 6 6 6-6" />}
    {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" />}
    {name === 'invoice' && <><Path d="M6 3h9l4 4v14H5V3h1Zm9 0v5h4M8 12h8M8 16h5" /></>}
    {name === 'reports' && <><Path d="M4 4v16h16M8 15v-4M12 15V7M16 15v-6" /></>}
    {name === 'settings' && <><Path d="M4 7h16M4 17h16" /><Rect x="8" y="4" width="4" height="6" rx="1" /><Rect x="14" y="14" width="4" height="6" rx="1" /></>}
  </Svg>;
}
