import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Rarity } from '../../../constants/theme';
import { Card, getCard } from '../../../firebase/cards';

const { width, height } = Dimensions.get('window');
const CARD_W = width * 0.72;
const CARD_H = CARD_W * 1.4;

type Phase = 'back' | 'image' | 'video';

export default function CardScreen() {
  const { id, reveal, owned: ownedParam } =
    useLocalSearchParams<{ id: string; reveal?: string; owned?: string }>();
  const isReveal = reveal === 'true';
  const isOwned  = ownedParam !== 'false';

  const [card, setCard]     = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase]   = useState<Phase>(
    isReveal ? 'back' : isOwned ? 'video' : 'image'
  );

  // ── Animation values ────────────────────────────────────────────────────────
  const enterAnim   = useRef(new Animated.Value(0)).current;
  const flipAnim    = useRef(new Animated.Value(0)).current; // 0 = back, 1 = front
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getCard(id).then((c) => {
      setCard(c);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!card || loading) return;

    // Entrance: slide up + fade in
    Animated.spring(enterAnim, {
      toValue: 1,
      damping: 14,
      stiffness: 120,
      useNativeDriver: true,
    }).start();

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.12,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start();

    if (!isReveal) {
      startShimmer();
      return;
    }

    // Reveal flow: flip at 600ms, show image, then video at 3.8s
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 750,
        useNativeDriver: true,
      }),
    ]).start();

    const t1 = setTimeout(() => setPhase('image'), 1350);
    const t2 = setTimeout(() => setPhase('video'), 3750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [card, loading]);

  // Start shimmer whenever card front is visible
  useEffect(() => {
    if (phase === 'back') return;
    startShimmer();
  }, [phase]);

  function startShimmer() {
    shimmerAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }

  // ── Video player ─────────────────────────────────────────────────────────────
  const player = useVideoPlayer(card?.videoUrl ?? '', (p) => { p.loop = true; });

  useEffect(() => {
    if (phase === 'video' && card?.videoUrl) player.play();
  }, [phase, card]);

  // ── Derived animated styles ──────────────────────────────────────────────────

  const cardEnterStyle = {
    opacity: enterAnim,
    transform: [
      { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [70, 0] }) },
      { scale:      enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
    ],
  };

  // Back face: 0° → 90° (disappears at midpoint)
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.4, 0.5],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  // Front face: -90° → 0° (appears at midpoint)
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-90deg', '-90deg', '0deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0.5, 0.55],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Shimmer sweep
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_W * 0.5, CARD_W * 1.4],
  });
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.15, 0.5, 0.85, 1],
    outputRange: [0, 0.55, 0.3, 0.55, 0],
  });

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
      {/* Background rarity glow */}
      <View style={[styles.glowBg, { shadowColor: rarityStyle.color }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Card */}
        <View style={styles.cardArea}>
          <Animated.View style={cardEnterStyle}>
            <View style={styles.cardOuter}>

              {/* Pulsing glow ring */}
              <Animated.View
                style={[
                  styles.glowRing,
                  { borderColor: rarityStyle.color, shadowColor: rarityStyle.color },
                  { transform: [{ scale: glowAnim }] },
                ]}
              />

              {/* Card content — overflow hidden */}
              <View style={styles.cardWrapper}>

                {/* ── Back face (reveal only) ─────────────────────────── */}
                {isReveal && (
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFillObject,
                      { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
                    ]}
                  >
                    <View style={styles.cardBack}>
                      <View style={[styles.cardBackBorder, { borderColor: rarityStyle.color + '99' }]}>
                        <View style={styles.cardBackContent}>
                          <Text style={styles.cardBackTitle}>CardDex</Text>
                          <View style={styles.cardBackDots}>
                            {Array.from({ length: 25 }).map((_, i) => (
                              <View
                                key={i}
                                style={[styles.cardBackDot, { opacity: i % 5 === 0 ? 0.55 : 0.18 }]}
                              />
                            ))}
                          </View>
                          <View style={[styles.cardBackGem, { backgroundColor: rarityStyle.color, shadowColor: rarityStyle.color }]} />
                          <Text style={[styles.cardBackRarity, { color: rarityStyle.color }]}>
                            {rarityStyle.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {/* ── Front face ─────────────────────────────────────── */}
                <Animated.View
                  style={[
                    StyleSheet.absoluteFillObject,
                    isReveal
                      ? { opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }
                      : undefined,
                  ]}
                >
                  {phase === 'video' && card.videoUrl ? (
                    <VideoView
                      player={player}
                      style={styles.cardMedia}
                      contentFit="cover"
                      nativeControls={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: card.imageUrl }}
                      style={styles.cardMedia}
                      resizeMode="cover"
                    />
                  )}

                  {/* Shimmer sweep */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.shimmer,
                      {
                        opacity: shimmerOpacity,
                        transform: [{ translateX: shimmerTranslate }, { skewX: '-15deg' }],
                      },
                    ]}
                  />
                </Animated.View>

              </View>
            </View>
          </Animated.View>
        </View>

        {/* Info panel */}
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

          {!isReveal && isOwned && (
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back to Binder</Text>
            </TouchableOpacity>
          )}

          {!isOwned && (
            <View style={styles.unownedBanner}>
              <Text style={styles.unownedBannerText}>🔒 Scan a QR code to collect this card</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  safeArea:   { flex: 1 },

  glowBg: {
    position: 'absolute',
    top: height * 0.12,
    alignSelf: 'center',
    width: CARD_W * 1.5,
    height: CARD_H * 1.2,
    borderRadius: CARD_W,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 90,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 12, right: 20,
    zIndex: 10,
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  cardArea:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardOuter: { width: CARD_W, height: CARD_H },

  glowRing: {
    position: 'absolute',
    top: -5, bottom: -5, left: -5, right: -5,
    borderRadius: 21,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 22,
    elevation: 12,
  },
  cardWrapper: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },

  // Card back design
  cardBack: { flex: 1, backgroundColor: '#09091f', padding: 14 },
  cardBackBorder: { flex: 1, borderRadius: 8, borderWidth: 1.5, overflow: 'hidden' },
  cardBackContent: {
    flex: 1, justifyContent: 'space-evenly', alignItems: 'center', paddingVertical: 20,
  },
  cardBackTitle: {
    color: Colors.primary, fontSize: Fonts.sizes.xxl,
    fontWeight: '900', letterSpacing: 4, textTransform: 'uppercase',
  },
  cardBackDots: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: CARD_W * 0.6, gap: 10, justifyContent: 'center',
  },
  cardBackDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  cardBackGem: {
    width: 44, height: 44, borderRadius: 22,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 14, elevation: 6,
  },
  cardBackRarity: { fontSize: Fonts.sizes.xs, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },

  cardMedia: { width: '100%', height: '100%' },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0,
    width: CARD_W * 0.38,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  // Info panel
  infoPanel: {
    paddingHorizontal: 24, paddingBottom: 16, paddingTop: 20,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: Colors.border,
    gap: 10,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardNumber: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: '600', letterSpacing: 1 },
  cardName:   { color: Colors.text, fontSize: Fonts.sizes.xxl, fontWeight: '900', marginTop: 2 },
  cardType:   { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, marginTop: 2 },
  statsRight: { alignItems: 'flex-end', gap: 8 },
  rarityBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  rarityText: { fontSize: Fonts.sizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  hpText:     { color: Colors.text, fontSize: Fonts.sizes.lg, fontWeight: '800' },
  description: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, lineHeight: 20 },

  addButton: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: '700' },

  backButton: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  backButtonText: { color: Colors.textSecondary, fontSize: Fonts.sizes.md, fontWeight: '600' },

  unownedBanner: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center', marginTop: 4,
    backgroundColor: Colors.card,
  },
  unownedBannerText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: '600', textAlign: 'center' },
});
