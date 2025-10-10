/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🔧 Configuración mínima funcional
  reactStrictMode: true,
  swcMinify: true,

  // ⚙️ Garantiza que se creen Serverless Functions
  output: undefined, // (asegura que no sea 'export')

  // 🚀 Opcional: fuerza Node.js runtime si usas Supabase admin
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
};

export default nextConfig;
