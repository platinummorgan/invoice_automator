import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { JobPhoto } from '../types';
import { pickJobPhoto } from '../services/jobPhotos';
import { useTheme } from '../contexts/ThemeContext';

export default function JobPhotos({ photos, onChange, finished = true, disabled = false, onBusyChange }: {
  photos: JobPhoto[]; onChange?: (photos: JobPhoto[]) => Promise<void> | void; finished?: boolean; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const change = async (next: JobPhoto[]) => {
    try { setBusy(true); await onChange?.(next); }
    catch (error: any) { Alert.alert('Could not save pictures', error.message); }
    finally { setBusy(false); }
  };
  const add = async (stage: JobPhoto['stage']) => {
    if (busy || disabled) return;
    try {
      setBusy(true);
      if (photos.length >= 12) throw new Error('You can add up to 12 pictures per job.');
      const photo = await pickJobPhoto(stage);
      if (photo) await onChange?.([...photos, photo]);
    } catch (error: any) { Alert.alert('Could not add picture', error.message); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    {(finished ? ['before', 'finished'] as const : ['before'] as const).map(stage => <View key={stage} style={{ gap: 10 }}>
      <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '600' }}>{stage === 'before' ? 'Job / before pictures' : 'Finished pictures'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {photos.filter(photo => photo.stage === stage).map(photo => <View key={photo.path}>
          <Image accessibilityLabel={stage === 'before' ? 'Job picture' : 'Finished job picture'} source={{ uri: photo.url }} style={{ width: 120, height: 100, borderRadius: 8 }} />
          {onChange && <TouchableOpacity accessibilityRole="button" disabled={busy || disabled} onPress={() => change(photos.filter(p => p.path !== photo.path))} style={{ padding: 10 }}>
            <Text style={{ color: theme.colors.error }}>Remove</Text>
          </TouchableOpacity>}
        </View>)}
      </View>
      {onChange && <TouchableOpacity accessibilityRole="button" disabled={busy || disabled} onPress={() => add(stage)} style={{ padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 }}>
        <Text style={{ color: theme.colors.primary }}>+ Add {stage === 'before' ? 'job' : 'finished'} picture</Text>
      </TouchableOpacity>}
    </View>)}
    {busy && <ActivityIndicator color={theme.colors.primary} />}
  </View>;
}
