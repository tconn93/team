/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Server-only packages (Prisma, Mastra, etc.) - moved from experimental in Next.js 15.2+
  serverExternalPackages: ['mastra', '@mastra/core', '@prisma/client', 'prisma', 'pg'],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent ALL Node.js core modules used by Prisma/Mastra from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        async_hooks: false,
        child_process: false,
        worker_threads: false,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        tls: false,
        net: false,
        'node:async_hooks': false,
        'node:child_process': false,
      };

      // Force externalization of server-only packages
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'mastra',
        '@mastra/core',
        '@prisma/client',
        'prisma',
      ];
    }
    return config;
  },
};

export default nextConfig;
