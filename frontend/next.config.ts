import type { NextConfig } from "next";

// mostly just security headers here, next.js doesn't set these by default and there's
// no backend framework (like express) in front of the frontend to add them for us
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*", // applies to literally every route in the app
        headers: [
          {
            // stops the site from being loaded in an iframe on someone else's page,
            // protects against clickjacking
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // stops the browser from trying to guess a file's content type, which can
            // be used to sneak scripts past filters that only check the declared type
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // only send the full referrer url on same-origin requests, trimmed down to
            // just the origin for cross-origin ones so we don't leak full urls elsewhere
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            // forces https for 2 years (in seconds), including subdomains, and opts into
            // browser hsts preload lists
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // we don't need any of these apis, so just turn them off entirely rather than
            // leaving the door open
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
