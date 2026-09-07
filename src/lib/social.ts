export type SubmitResult =
  | { state: "published"; remoteId: string }
  | { state: "failed"; reason: string }
  | { state: "unknown"; reason: string };
export interface SocialAdapter {
  provider: string;
  supportsReconciliation: boolean;
  validate(input: { account: string; mime: string; width: number; height: number; caption: string; alt: string }): Promise<string[]>;
  upload(asset: Buffer): Promise<{ mediaId: string }>;
  publish(input: { mediaId: string; caption: string; idempotencyKey: string }): Promise<SubmitResult>;
  getStatus(idempotencyKey: string): Promise<SubmitResult>;
}
export function mayRetry(state: string, reconciledAbsent = false) {
  return state === "failed" || (state === "unknown" && reconciledAbsent);
}
export const socialPlatforms = [
  { name: "Instagram", status: "Professional account + API access required", url: "https://www.instagram.com/" },
  { name: "Facebook", status: "Pages only; eligible authorization required", url: "https://www.facebook.com/" },
  { name: "Threads", status: "Authorized account required", url: "https://www.threads.com/" },
  { name: "X", status: "Current paid API access required", url: "https://x.com/" },
  { name: "Bluesky", status: "Candidate connector; not implemented", url: "https://bsky.app/" },
  { name: "Mastodon", status: "Instance authorization; not implemented", url: "https://joinmastodon.org/" },
  { name: "LinkedIn", status: "Member / organization access differs", url: "https://www.linkedin.com/" },
  { name: "Pinterest", status: "Authorized board required", url: "https://www.pinterest.com/" },
  { name: "TikTok", status: "Private team utility Direct Post is ineligible; video later", url: "https://www.tiktok.com/" },
  { name: "YouTube", status: "Shorts video later; no still / Community endpoint", url: "https://www.youtube.com/" },
];
export const activeSocialAdapters: SocialAdapter[] = [];
