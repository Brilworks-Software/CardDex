import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Card } from '../firebase/cards';
import { Colors, Fonts, Rarity } from '../constants/theme';

const { width } = Dimensions.get('window');
const SLOT_W = (width - 12 * 3) / 2;
const SLOT_H = SLOT_W * 1.4;

type Props = {
  card: Card;
  owned: boolean;
  onPress: () => void;
};

export default function CardSlot({ card, owned, onPress }: Props) {
  const rarityStyle = Rarity[card.rarity];

  if (!owned) {
    return (
      <View style={[styles.slot, styles.missingSlot]}>
        {/* Silhouette */}
        <View style={styles.silhouette}>
          <Text style={styles.missingNumber}>#{String(card.number).padStart(3, '0')}</Text>
          <View style={styles.questionMark}>
            <Text style={styles.questionText}>?</Text>
          </View>
          <Text style={styles.missingName}>{card.name}</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.slot, styles.ownedSlot, { shadowColor: rarityStyle.color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: card.imageUrl }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      {/* Rarity stripe */}
      <View style={[styles.rarityStripe, { backgroundColor: rarityStyle.color }]} />
      {/* Info overlay */}
      <View style={styles.infoOverlay}>
        <Text style={styles.slotNumber}>#{String(card.number).padStart(3, '0')}</Text>
        <Text style={styles.slotName} numberOfLines={1}>{card.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: SLOT_W,
    height: SLOT_H,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ownedSlot: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  missingSlot: {
    backgroundColor: Colors.missing,
    borderWidth: 1,
    borderColor: Colors.missingBorder,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  rarityStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  slotNumber: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  slotName: {
    color: Colors.text,
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
  },
  silhouette: {
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  missingNumber: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  questionMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.missingBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionText: {
    color: Colors.textMuted,
    fontSize: 22,
    fontWeight: '900',
  },
  missingName: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.xs,
    textAlign: 'center',
    fontWeight: '500',
  },
});
