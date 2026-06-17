/** @type {import('next').NextConfig} */

// Minimal Next.js config. We keep this small and explicit on purpose.
// The MediaPipe vision package ships WebAssembly (.wasm) files; Next.js handles
// those fine when we load them from the CDN at runtime (see lib/biometrics/visionLoader.js),
// so there is nothing special to configure here.
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
