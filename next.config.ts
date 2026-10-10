import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Opt-in local build settings for the measured low-memory host; default CI build is unchanged.
  ...(process.env.KAIDA_LOW_MEMORY_BUILD === '1' ? { experimental: { cpus: 1, webpackMemoryOptimizations: true } } : {}),
};

export default nextConfig;
