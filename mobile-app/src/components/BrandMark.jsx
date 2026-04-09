import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function BrandMark({ size = 14 }) {
  const outerSize = size;
  const innerSize = Math.round(size * 0.72);

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize }]}>
      <View style={[styles.outer, { width: outerSize, height: outerSize }]} />
      <View style={[styles.inner, { width: innerSize, height: innerSize }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#ffffff',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  inner: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ rotate: '45deg' }],
  },
});
