import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';

export default function App() {
  const [loaded] = useFonts({
    'Pretendard-Regular': require('./assets/font/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('./assets/font/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('./assets/font/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('./assets/font/Pretendard-Bold.ttf'),
  });

  if (!loaded) return null;

  useEffect(() => {
    if (!loaded) return;

    const RNText = Text as any;
    const RNTextInput = TextInput as any;

    RNText.defaultProps = RNText.defaultProps || {};
    RNTextInput.defaultProps = RNTextInput.defaultProps || {};

    RNText.defaultProps.style = [
      { fontFamily: 'Pretendard-Regular' },
      RNText.defaultProps.style,
    ];

    RNTextInput.defaultProps.style = [
      { fontFamily: 'Pretendard-Regular' },
      RNTextInput.defaultProps.style,
    ];
  }, [loaded]);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
