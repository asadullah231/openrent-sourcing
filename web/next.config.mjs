/** @type {import('next').NextConfig} */
const nextConfig = {
  // /leads ab /sourcing hai (13 Aug directive: "Lead" user-facing lafz nahi).
  // Purane bookmarks/links tootne nahi chahiye, is liye permanent redirect.
  async redirects() {
    return [
      { source: '/leads', destination: '/sourcing', permanent: true },
      { source: '/leads/:id', destination: '/sourcing/:id', permanent: true },
    ];
  },
};
export default nextConfig;
