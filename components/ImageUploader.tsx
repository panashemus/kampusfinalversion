'use client';

import { useState, useRef, useCallback } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { uploadImages } from '@/lib/payment';

export default function ImageUploader({
  userId,
  onUploaded,
  onError,
}: {
  userId: string;
  onUploaded: (urls: string[]) => void;
  onError?: (msg: string) => void;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setUploading(true);
    const localPreviews = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...localPreviews]);
    const urls = await uploadImages(imageFiles, userId);
    if (urls.length > 0) {
      onUploaded(urls);
    } else {
      onError?.('Failed to upload images. Please try again.');
      setPreviews((prev) => prev.filter((p) => !localPreviews.includes(p)));
    }
    setUploading(false);
  }, [userId, onUploaded, onError]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
    }
  }, [handleFiles]);

  const removePreview = (idx: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg bg-surface border border-gray-800 px-3 py-2 text-sage text-xs font-bold active:scale-95 transition-transform disabled:opacity-50"
        >
          <ImagePlus className="w-4 h-4" strokeWidth={1.5} />
          {uploading ? 'Uploading...' : 'Add Image'}
        </button>
        <span className="text-sage text-[10px]">or paste from clipboard</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {previews.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {previews.map((src, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-800">
              <img src={src} alt={`upload-${i}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePreview(i)}
                className="absolute top-0 right-0 w-5 h-5 bg-black/70 flex items-center justify-center rounded-bl-lg"
              >
                <X className="w-3 h-3 text-white" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
