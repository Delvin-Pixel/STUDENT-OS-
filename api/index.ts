import { createApp } from "../server/_core/app";

// Vercel invokes the handler directly; do not bind a TCP port at module load.
export default createApp();
