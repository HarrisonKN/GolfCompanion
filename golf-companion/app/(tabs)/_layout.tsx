// app/(tabs)/_layout.tsx
import { CourseProvider } from "@/components/CourseContext";
import { useTheme } from "@/components/ThemeContext";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  const { palette } = useTheme();
  return (
    <CourseProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: palette.primary,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            height: 64,
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            borderTopWidth: 0,
            shadowColor: palette.black,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 12,
          },
          tabBarActiveTintColor: palette.white,
          tabBarInactiveTintColor: palette.secondary,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontWeight: "700", fontSize: 13 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} /> }} />
        <Tabs.Screen name="scorecard" options={{ title: "Scorecard", tabBarIcon: ({ color }) => <MaterialIcons name="view-list" size={28} color={color} /> }} />
        <Tabs.Screen name="course-view" options={{ title: "Course View", tabBarIcon: ({ color }) => <MaterialIcons name="golf-course" size={28} color={color} /> }} />
        <Tabs.Screen name="golfHub" options={{ title: "GolfHub", tabBarIcon: ({ color }) => <MaterialIcons name="audiotrack" size={28} color={color} /> }} />
        <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <MaterialIcons name="account-circle" size={28} color={color} /> }} />
      </Tabs>
    </CourseProvider>
  );
}