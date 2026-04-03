import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from '../firebase/cards';
import { Colors, Fonts, Rarity } from '../constants/theme';

const { width } = Dimensions.get('window');
const SLOT_W = (width - 12 * 3) / 2;
const SLOT_H = SLOT_W * 1.4;

const SHIMMER_RARITIES = new Set(['rare', 'legendary']);

type Props = {
  card: Card;
  owned: boolean;
  onPress: () => void;
  index?: number;
};

export default function CardSlot({ card, owned, onPress, index = 0 }: Props) {
  const rarityStyle = Rarity[card.rarity];
  const hasShimmer  = owned && SHIMMER_RARITIES.has(card.rarity);

  const enterAnim   = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Staggered entrance
  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      delay: Math.min(index * 60, 300),
      damping: 16,
      stiffness: 130,
      useNativeDriver: true,
    }).start();
  }, []);

  // Shimmer loop for rare / legendary owned cards
  useEffect(() => {
    if (!hasShimmer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 120 + 2800),
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasShimmer]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SLOT_W * 0.5, SLOT_W * 1.4],
  });
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.15, 0.5, 0.85, 1],
    outputRange: [0, 0.5, 0.28, 0.5, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: enterAnim,
        transform: [{ scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
      }}
    >
      <TouchableOpacity
        style={[
          styles.slot,
          owned
            ? [styles.ownedSlot, { shadowColor: rarityStyle.color }]
            : styles.unownedSlot,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Card image — shown for all cards */}
        <Image
          source={{ uri: card.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        {/* Unowned overlay: dark tint + blur-like dimming + lock */}
        {!owned && (
          <View style={styles.unownedOverlay}>
            <View style={styles.lockCircle}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
          </View>
        )}

        {/* Rarity stripe — only for owned */}
        {owned && (
          <View style={[styles.rarityStripe, { backgroundColor: rarityStyle.color }]} />
        )}

        {/* Shimmer sweep — rare / legendary owned */}
        {hasShimmer && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                transform: [{ translateX: shimmerTranslate }, { skewX: '-12deg' }],
              },
            ]}
          />
        )}

        {/* Info overlay at bottom */}
        <View style={[styles.infoOverlay, !owned && styles.infoOverlayUnowned]}>
          <Text style={styles.slotNumber}>#{String(card.number).padStart(3, '0')}</Text>
          <Text style={styles.slotName} numberOfLines={1}>{card.name}</Text>
          {!owned && <Text style={styles.unownedLabel}>Not collected</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: SLOT_W,
    height: SLOT_H,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  ownedSlot: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 7,
  },
  unownedSlot: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    shadowColor: '#000',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  // Dark tint for unowned cards
  unownedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 5, 20, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 18,
  },
  rarityStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SLOT_W * 0.38,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  infoOverlayUnowned: {
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  unownedLabel: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.xs,
    marginTop: 1,
  },
});
