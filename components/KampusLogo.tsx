import Image from 'next/image';

export default function KampusLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <Image
      src="/images/ClipSnap_20260723201232.png"
      alt="KAMPUS"
      width={332}
      height={390}
      className={`${className} object-contain shrink-0`}
      unoptimized
    />
  );
}
