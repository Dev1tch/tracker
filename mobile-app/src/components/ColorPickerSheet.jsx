import React from 'react';
import { StyleSheet, View } from 'react-native';

import ModalSheet from './ModalSheet';
import ColorField from './ColorField';
import ActionButton from './ActionButton';

// A bottom-sheet wrapper around ColorField (always-open wheel + presets), so the
// same custom color picker is used everywhere a compact UI can't host it inline.
export default function ColorPickerSheet({
  visible,
  title = 'Color',
  value,
  presetColors = [],
  onChange,
  onClose,
}) {
  return (
    <ModalSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={(
        <View style={styles.footer}>
          <ActionButton label="Done" icon="checkmark" onPress={onClose} />
        </View>
      )}
    >
      <ColorField label="" value={value} presetColors={presetColors} onChange={onChange} alwaysOpen />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end' },
});
