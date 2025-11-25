// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Esta screen apunta a app/index.tsx */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
