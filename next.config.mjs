/** @type {import('next').NextConfig} */
const nextConfig={
  devIndicators:false,
  ...(process.env.CAPACITOR_BUILD==='1'?{output:'export',trailingSlash:true}:{}),
};
export default nextConfig;
