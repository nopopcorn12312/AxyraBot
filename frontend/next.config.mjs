/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow loading Twitch profile pictures from the CDN domain.
    domains: ["static-cdn.jtvnw.net"],
  },
};

export default nextConfig;
