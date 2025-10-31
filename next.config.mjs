/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
      bodySizeLimit: '10mb', // ⬅️ AGREGAR ESTA LÍNEA
    },
  },
};

export default nextConfig;