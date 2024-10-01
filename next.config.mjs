/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
      return [
        {
          source: '/',  // Redirect from root URL
          destination: '/search',  // Redirect to the search page
          permanent: true,  // Use a 308 permanent redirect
        },
      ]
    },
  }
  
  export default nextConfig
  