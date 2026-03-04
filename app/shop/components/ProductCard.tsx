'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface ProductCardProps {
  title: string;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  ctaHref: string;
}

export function ProductCard({ title, description, price, imageUrl, ctaHref }: ProductCardProps) {
  return (
    <motion.div
      className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur p-4 flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
      whileHover={{ translateY: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className="relative w-full overflow-hidden rounded-2xl bg-black/30 border border-white/5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center text-white/40 text-sm">
            Image coming soon
          </motion.div>
        )}
      </div>
      <div className="flex flex-col gap-2 mt-4 flex-1">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {price && <p className="text-sm text-[#7ff5fb]">{price}</p>}
        </div>
        {description && (
          <p className="text-sm text-white/60 line-clamp-3">{description}</p>
        )}
      </div>
      <Link
        href={ctaHref}
        className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[#00C2CB] text-black font-semibold py-2 hover:bg-[#00b0b8]"
        prefetch={false}
      >
        View product
      </Link>
    </div>
  );
}
