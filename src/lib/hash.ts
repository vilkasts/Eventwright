import { createHash } from "node:crypto";

export const sha256 = (content: string | Uint8Array): string => createHash("sha256").update(content).digest("hex");
