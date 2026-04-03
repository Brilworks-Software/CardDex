import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllCards, Card } from '../../firebase/cards';
import { getUserBinder } from '../../firebase/qrcodes';
import { logoutUser } from '../../firebase/auth';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Fonts } from '../../constants/theme';
import CardSlot from '../../components/CardSlot';

export default function BinderScreen() {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [allCards, binderIds] = await Promise.all([
        getAllCards(),
        getUserBinder(user.uid),
      ]);
      setCards(allCards);
      setOwned(binderIds);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const collectedCount = owned.length;
  const totalCount = cards.length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>CardDex</Text>
          <Text style={styles.subtitle}>
            {user?.displayName ? `${user.displayName}'s Collection` : 'My Collection'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logoutUser}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Collected</Text>
          <Text style={styles.progressCount}>
            <Text style={styles.progressCurrent}>{collectedCount}</Text>
            <Text style={styles.progressTotal}> / {totalCount}</Text>
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: totalCount > 0 ? `${(collectedCount / totalCount) * 100}%` : '0%' },
            ]}
          />
        </View>
      </View>

      {/* Card Grid */}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => (
          <CardSlot
            card={item}
            owned={owned.includes(item.id)}
            onPress={() => {
              if (owned.includes(item.id)) {
                router.push(`/(app)/card/${item.id}`);
              }
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No cards found.</Text>
            <Text style={styles.emptySubtext}>Scan a QR code to add your first card!</Text>
          </View>
        }
      />

      {/* Scan FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/scan')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>⬡</Text>
        <Text style={styles.fabText}>Scan Card</Text>
      </TouchableOpacity>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
  },
  progressContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  progressCount: {
    fontSize: Fonts.sizes.sm,
  },
  progressCurrent: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: Fonts.sizes.md,
  },
  progressTotal: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: Colors.text,
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 20,
    color: '#fff',
  },
  fabText: {
    color: '#fff',
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
  },
});
