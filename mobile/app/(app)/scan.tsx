import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { redeemCode } from '../../firebase/qrcodes';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Fonts } from '../../constants/theme';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const lastScanned = useRef<string | null>(null);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanning || !user) return;
    if (lastScanned.current === data) return;
    lastScanned.current = data;

    setScanning(true);

    // Extract code from URL or use raw value
    let code = data;
    try {
      const url = new URL(data);
      const parts = url.pathname.split('/');
      code = parts[parts.length - 1] || data;
    } catch {
      // Not a URL, use raw data as code
    }

    try {
      const result = await redeemCode(code, user.uid);

      if (result.success) {
        router.replace(`/(app)/card/${result.cardId}?reveal=true`);
      } else {
        const messages = {
          not_found:     "This QR code isn't valid.",
          already_used:  'This card has already been claimed by someone else.',
          already_owned: 'You already have this card in your binder!',
          server_error:  'Something went wrong. Please try again.',
        };
        Alert.alert('Oops!', messages[result.error], [
          {
            text: 'OK',
            onPress: () => {
              lastScanned.current = null;
              setScanning(false);
            },
          },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.', [
        {
          text: 'OK',
          onPress: () => {
            lastScanned.current = null;
            setScanning(false);
          },
        },
      ]);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permText}>
            CardDex needs your camera to scan QR codes on your physical cards.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <SafeAreaView>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.scanTitle}>Scan Card QR</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        {/* Viewfinder */}
        <View style={styles.viewfinderArea}>
          <View style={styles.viewfinder}>
            {/* Corner marks */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {scanning && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.processingText}>Redeeming card...</Text>
              </View>
            )}
          </View>
          <Text style={styles.scanHint}>Point at the QR code on your card</Text>
        </View>
      </View>
    </View>
  );
}

const VIEWFINDER = 260;
const CORNER = 20;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scanTitle: {
    color: '#fff',
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
  },
  viewfinderArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: VIEWFINDER,
    height: VIEWFINDER,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    gap: 12,
  },
  processingText: {
    color: '#fff',
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
  },
  scanHint: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 24,
    fontSize: Fonts.sizes.md,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: Colors.background,
  },
  permTitle: {
    color: Colors.text,
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  permText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: {
    color: '#fff',
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 16,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
  },
});
