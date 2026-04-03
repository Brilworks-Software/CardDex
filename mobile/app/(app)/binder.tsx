import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [showSignOutModal, setShowSignOutModal] = useState(false);

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
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowSignOutModal(true)}>
          <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
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
        renderItem={({ item, index }) => (
          <CardSlot
            card={item}
            owned={owned.includes(item.id)}
            index={index}
            onPress={() => {
              const isOwned = owned.includes(item.id);
              router.push(`/(app)/card/${item.id}?owned=${isOwned ? 'true' : 'false'}`);
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

      {/* Sign-out confirmation modal */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="log-out-outline" size={48} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to sign out of your account?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => { setShowSignOutModal(false); logoutUser(); }}
              >
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    color: Colors.text,
    marginTop: 2,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    color: Colors.primary,
    fontSize: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  modalIcon: {
    fontSize: 36,
    color: Colors.primary,
    marginBottom: 4,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: Fonts.sizes.xl,
    fontWeight: '800',
  },
  modalMessage: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
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
