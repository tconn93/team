/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Server-only packages - pg uses native bindings
  serverExternalPackages: ['pg'],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent Node.js core modules from leaking into the client bundle
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
        'pg',
      ];
    }
    return config;
  },
};

export default nextConfig;