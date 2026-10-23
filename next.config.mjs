import { lanAddresses } from './scripts/lan-network.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // `pnpm lan:dev` serves the dev build to other devices by name and by IP.
  allowedDevOrigins: [process.env.CAFETEC_HOSTNAME ?? 'cafetec.local', ...lanAddresses().map((a) => a.address)],
}

export default nextConfig
