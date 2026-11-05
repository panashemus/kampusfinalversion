import { supabase } from './supabase';

export function generateReferenceCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `KMP-${num}`;
}

export async function uploadPostImage(
  file: File,
  userId: string
): Promise<string | null> {
  const types: Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!types[file.type]||file.size>5242880)return null;
  const ext=types[file.type];
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('post_media')
    .upload(fileName, file, { contentType: file.type, upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from('post_media').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function uploadImages(
  files: File[],
  userId: string
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files.slice(0,8)) {
    const url = await uploadPostImage(file, userId);
    if (url) urls.push(url);
  }
  return urls;
}
