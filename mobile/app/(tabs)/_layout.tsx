import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import { ColorValue } from "react-native";

import { colors } from "@/utils/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="sleep" options={{ title: "Sleep", tabBarIcon: tabIcon("moon") }} />
      <Tabs.Screen name="caffeine" options={{ title: "Caffeine", tabBarIcon: tabIcon("cafe") }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: tabIcon("stats-chart") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("person") }} />
    </Tabs>
  );
}
