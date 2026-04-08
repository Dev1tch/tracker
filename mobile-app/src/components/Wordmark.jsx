import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

export default function Wordmark({ pulseMark = false, style = null }) {
  const opacity = useSharedValue(pulseMark ? 0.3 : 0.6);

  useEffect(() => {
    if (!pulseMark) {
      opacity.value = 0.6;
      return undefined;
    }

    opacity.value = withRepeat(withTiming(0.8, { duration: 1500 }), -1, true);
    return undefined;
  }, [opacity, pulseMark]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.row, style]}>
      <AnimatedView style={[styles.mark, animatedStyle]} />
      <Text style={styles.label}>Life tracker</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mark: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ rotate: '45deg' }],
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
});
