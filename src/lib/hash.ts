// Content fingerprints: artifacts and approvals are identified by the sha256 of their bytes.
import { createHash } from "node:crypto";

// The sha256 of a text or file content, as a hex string. Any change to the content changes the hash.
export const sha256 = (content: string | Uint8Array): string => createHash("sha256").update(content).digest("hex");
