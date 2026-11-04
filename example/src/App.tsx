import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SplashMotion from 'react-native-splash-motion';

// Pretend the app needs ~2.5s to boot (fonts, auth, remote config…).
const fakeBoot = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 2500));

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fakeBoot().then(async () => {
      setReady(true);
      // Finish the current loop, play the "outro" marker, then fade out.
      await SplashMotion.hide({ outro: 'outro' });
      console.log('[example] splash is gone');
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SplashMotion</Text>
      <Text style={styles.subtitle}>
        {ready ? 'Your app is ready 🎉' : 'Booting…'}
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => console.log('visible:', SplashMotion.isVisible())}
      >
        <Text style={styles.buttonText}>Log isVisible()</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.7 },
  button: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0F6E56',
  },
  buttonText: { color: 'white', fontWeight: '600' },
});
