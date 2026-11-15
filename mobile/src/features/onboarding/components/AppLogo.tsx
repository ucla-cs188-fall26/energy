import Svg, { Circle, Path, Rect } from "react-native-svg";

import { colors } from "@/utils/theme";

const MUG = "#B9A8F5";

/** Moon-and-mug app mark on a soft rounded tile. */
export function AppLogo({ size = 104 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="EnergySync logo">
      <Rect x={0} y={0} width={100} height={100} rx={32} fill={colors.primarySoft} />
      {/* Crescent: a full moon with an offset tile-colored circle cut over it. */}
      <Circle cx={44} cy={50} r={20} fill={colors.primary} />
      <Circle cx={55} cy={42} r={17} fill={colors.primarySoft} />
      {/* Sparkle and dot. */}
      <Path d="M70 24 L72 30 L78 32 L72 34 L70 40 L68 34 L62 32 L68 30 Z" fill={colors.primary} />
      <Circle cx={80} cy={42} r={2.2} fill={colors.primary} />
      {/* Mug with handle. */}
      <Path d="M68 56 h3 a5 5 0 0 1 0 10 h-3" stroke={MUG} strokeWidth={3} fill="none" />
      <Rect x={48} y={52} width={21} height={18} rx={5} fill={MUG} stroke={colors.surface} strokeWidth={3} />
    </Svg>
  );
}
