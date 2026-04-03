import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image } from 'react-native';
import { getCard, Card } from '../../../firebase/cards';
import { Colors, Fonts, Rarity } from '../../../constants/theme';

const { width, height } = Dimensions.get('window');
const CARD_W = width * 0.72;
const CARD_H = CARD_W * 1.4;

export default function CardScreen() {
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  const isReveal = reveal === 'true';

  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'image' | 'transition' | 'video'>(
    isReveal ? 'image' : 'video'
  );

  // Animation values
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);
  const glowOpacity = useSharedValue(0);
  const shimmerX = useSharedValue(-CARD_W);
  const videoOpacity = useSharedValue(0);
  const imageOpacity = useSharedValue(1);
  const cardRotate = useSharedValue(0);

  useEffect(() => {
    getCard(id).then((c) => {
      setCard(c);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!card || loading) return;

    if (isReveal) {
      // Entry animation
      opacity.value = withTiming(1, { duration: 600 });
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });

      // Glow pulse
      glowOpacity.value = withDelay(
        800,
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.4, { duration: 400 }),
          withTiming(1, { duration: 400 }),
          withTiming(0.4, { duration: 400 }),
          withTiming(1, { duration: 400 })
        )
      );

      // Shimmer
      shimmerX.value = withDelay(
        800,
        withSequence(
          withTiming(CARD_W * 2, { duration: 700, easing: Easing.out(Easing.quad) }),
          withTiming(-CARD_W, { duration: 0 }),
          withDelay(
            400,
            withTiming(CARD_W * 2, { duration: 700, easing: Easing.out(Easing.quad) })
          )
        )
      );

      // After shimmer, crack open → transition to video
      setTimeout(() => startTransition(), 3200);
    } else {
      opacity.value = withTiming(1, { duration: 400 });
      scale.value = withSpring(1, { damping: 14 });
      videoOpacity.value = withTiming(1, { duration: 500 });
      imageOpacity.value = 0;
    }
  }, [card, loading]);

  const startTransition = () => {
    setPhase('transition');
    // Card shake
    cardRotate.value = withSequence(
      withTiming(-6, { duration: 80 }),
      withTiming(6, { duration: 80 }),
      withTiming(-4, { duration: 80 }),
      withTiming(4, { duration: 80 }),
      withTiming(0, { duration: 80 })
    );

    // Scale up briefly then crossfade image → video
    scale.value = withSequence(
      withTiming(1.05, { duration: 300 }),
      withTiming(1, { duration: 200 })
    );

    setTimeout(() => {
      imageOpacity.value = withTiming(0, { duration: 600 });
      videoOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
      setTimeout(() => runOnJS(setPhase)('video'), 900);
    }, 500);
  };

  // Video player
  const player = useVideoPlayer(card?.videoUrl ?? '', (p) => {
    p.loop = true;
    if (phase === 'video' || !isReveal) {
      p.play();
    }
  });

  useEffect(() => {
    if (phase === 'video') {
      player.play();
    }
  }, [phase]);

  const cardAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      {
        rotate: `${interpolate(cardRotate.value, [-10, 10], [-10, 10], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const glowAnim = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const shimmerAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  const imageAnim = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const videoAnim = useAnimatedStyle(() => ({
    opacity: videoOpacity.value,
  }));

  const rarityStyle = card ? Rarity[card.rarity] : Rarity.common;

  if (loading || !card) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background glow blob */}
      <Animated.View style={[styles.glowBg, glowAnim, { shadowColor: rarityStyle.color }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Card */}
        <View style={styles.cardArea}>
          <Animated.View style={[styles.cardWrapper, cardAnim]}>
            {/* Glow ring */}
            <Animated.View
              style={[
                styles.glowRing,
                glowAnim,
                { borderColor: rarityStyle.color, shadowColor: rarityStyle.color },
              ]}
            />

            {/* Card image (shown during reveal phase) */}
            {isReveal && (
              <Animated.View style={[StyleSheet.absoluteFillObject, imageAnim]}>
                <Image
                  source={{ uri: card.imageUrl }}
                  style={styles.cardMedia}
                  resizeMode="cover"
                />
                {/* Shimmer overlay */}
                <Animated.View style={[styles.shimmer, shimmerAnim]} />
              </Animated.View>
            )}

            {/* Video (fades in during transition) */}
            <Animated.View style={[StyleSheet.absoluteFillObject, videoAnim]}>
              <VideoView
                player={player}
                style={styles.cardMedia}
                contentFit="cover"
                nativeControls={false}
              />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Card Info */}
        <View style={styles.infoPanel}>
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.cardNumber}>#{String(card.number).padStart(3, '0')}</Text>
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardType}>{card.type}</Text>
            </View>
            <View style={styles.statsRight}>
              <View style={[styles.rarityBadge, { backgroundColor: rarityStyle.color + '22', borderColor: rarityStyle.color }]}>
                <Text style={[styles.rarityText, { color: rarityStyle.color }]}>
                  {rarityStyle.label}
                </Text>
              </View>
              <Text style={styles.hpText}>HP {card.hp}</Text>
            </View>
          </View>

          <Text style={styles.description}>{card.description}</Text>

          {isReveal && phase === 'video' && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.replace('/(app)/binder')}
            >
              <Text style={styles.addButtonText}>Add to Binder →</Text>
            </TouchableOpacity>
          )}

          {!isReveal && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back to Binder</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  glowBg: {
    position: 'absolute',
    top: height * 0.15,
    alignSelf: 'center',
    width: CARD_W * 1.4,
    height: CARD_H * 1.2,
    borderRadius: CARD_W,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 80,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  glowRing: {
    position: 'absolute',
    inset: -3,
    borderRadius: 19,
    borderWidth: 2,
    zIndex: 5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  cardMedia: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: CARD_W * 0.4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ skewX: '-20deg' }],
  },
  infoPanel: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 20,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardNumber: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardName: {
    color: Colors.text,
    fontSize: Fonts.sizes.xxl,
    fontWeight: '900',
    marginTop: 2,
  },
  cardType: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    marginTop: 2,
  },
  statsRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  rarityBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  rarityText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hpText: {
    color: Colors.text,
    fontSize: Fonts.sizes.lg,
    fontWeight: '800',
  },
  description: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
  },
  backButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
  },
});
