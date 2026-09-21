import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { JobPhoto } from '../types';

export async function pickJobPhoto(stage: JobPhoto['stage']): Promise<JobPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access to add job pictures.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, quality: 0.6, base64: true });
  if (result.canceled) return null;
  const base64 = result.assets[0]?.base64;
  if (!base64) throw new Error('Unable to read photo. Please choose another image.');
  const binary = atob(base64);
  if (binary.length > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.');
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in again.');
  const path = `${user.id}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('job-photos').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
  if (error) throw error;
  return (await resolvePhotos([{ path, stage }]))[0];
}

export async function resolvePhotos(photos: JobPhoto[]): Promise<JobPhoto[]> {
  return Promise.all(photos.map(async photo => {
    const { data, error } = await supabase.storage.from('job-photos').createSignedUrl(photo.path, 3600);
    if (error) throw new Error('Unable to load job pictures. Please try again.');
    return { ...photo, url: data.signedUrl };
  }));
}
