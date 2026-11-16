import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTrackingSync } from "@/services/tracking-sync";
import { colors } from "@/utils/theme";
export function SyncStatus() {
  const { loading, error, refresh } = useTrackingSync();
  if (!loading && !error) return null;
  return <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <Pressable accessibilityRole="button" onPress={() => void refresh()}>
      <Text style={{ color: colors.textMuted }}>{error} Retry</Text>
    </Pressable> : null}
  </View>;
}
