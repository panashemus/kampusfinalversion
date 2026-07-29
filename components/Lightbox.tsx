'use client';

import { X } from 'lucide-react';

export default function Lightbox({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface flex items-center justify-center" onClick={onClose}>
        <X className="w-5 h-5 text-white" strokeWidth={2} />
      </button>
      <img
        src={images[initialIndex]}
        alt="fullsize"
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
