import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for document uploads (Phase 4). The
      // real enforcement is validateFile()'s MAX_FILE_SIZE_BYTES —
      // this just needs to be large enough not to reject a valid
      // upload before that check ever runs.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
