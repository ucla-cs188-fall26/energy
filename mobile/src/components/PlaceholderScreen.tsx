import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/utils/theme";

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>
        <Text style={styles.soon}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  soon: { color: colors.textMuted },
});
