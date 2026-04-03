import { Stack } from 'expo-router';
import { Colors } from '../../constants/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="binder" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen
        name="card/[id]"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </Stack>
  );
}
