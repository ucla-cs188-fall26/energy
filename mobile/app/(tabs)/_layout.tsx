import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps, useEffect } from "react";
import { ColorValue } from "react-native";

import { refreshProfile } from "@/features/profile/store";
import { colors } from "@/utils/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Filled icon on the active tab, outline otherwise. */
function tabIcon(filled: IconName, outline: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  // Pick up the latest name and sleep schedule each time the signed-in app opens.
  useEffect(() => { void refreshProfile(); }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: "700" },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home", "home-outline") }} />
      <Tabs.Screen name="sleep" options={{ title: "Sleep", tabBarIcon: tabIcon("moon", "moon-outline") }} />
      <Tabs.Screen name="caffeine" options={{ title: "Caffeine", tabBarIcon: tabIcon("cafe", "cafe-outline") }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: tabIcon("stats-chart", "stats-chart-outline") }} />
    </Tabs>
  );
}
