import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, TextInputProps } from "react-native";

import { colors } from "@/utils/theme";
import { TextField } from "./TextField";

/** Back chevron; falls back to Welcome when there's no screen to go back to. */
export function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      style={styles.back}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"))}
    >
      <Ionicons name="chevron-back" size={26} color={colors.text} />
    </Pressable>
  );
}

type PasswordProps = TextInputProps & { label?: string; labelAccessory?: ReactNode; error?: string | null };

/** Password field with a Show/Hide toggle inside the right edge. */
export function PasswordField({ label = "Password", ...props }: PasswordProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      label={label}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      suffix={
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setVisible((v) => !v)}>
          <Text style={styles.link}>{visible ? "Hide" : "Show"}</Text>
        </Pressable>
      }
    />
  );
}

export const authStyles = StyleSheet.create({
  title: { fontSize: 34, lineHeight: 40, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 17, lineHeight: 24, color: colors.textMuted },
  footerText: { textAlign: "center", fontSize: 16, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
  message: { fontSize: 15, lineHeight: 21, color: colors.text },
});

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", paddingVertical: 8 },
  link: { fontSize: 16, fontWeight: "700", color: colors.primary },
});
