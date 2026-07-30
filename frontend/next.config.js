/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three / r3f / drei ship untranspiled ESM that Next's default compile of
  // node_modules can choke on; transpiling them here keeps the 3D hero building.
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

module.exports = nextConfig;
