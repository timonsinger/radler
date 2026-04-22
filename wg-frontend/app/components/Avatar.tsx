'use client';

import { getImageUrl } from '../lib/api';

interface AvatarProps {
  src: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

export default function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const imageUrl = getImageUrl(src);
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary font-bold`}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
