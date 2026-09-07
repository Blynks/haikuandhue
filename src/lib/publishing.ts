export type DestinationSlug =
  | "instagram"
  | "facebook-pages"
  | "threads"
  | "x"
  | "bluesky"
  | "mastodon"
  | "linkedin"
  | "pinterest"
  | "tiktok"
  | "youtube-shorts"
  | "manual-export";

export type DestinationState = "planned" | "connected" | "blocked" | "manual-export";

export type PublishingCapability = {
  slug: DestinationSlug;
  label: string;
  state: DestinationState;
  canSchedule: boolean;
  canPublishImages: boolean;
  canPublishVideo: boolean;
  note: string;
};

export interface PublishingAdapter {
  capability: PublishingCapability;
  prepareManualExport(input: { caption: string; altText: string; imageUrl: string }): { copyCaption: string; downloadUrl: string; altText: string };
  schedule?(): Promise<never>;
}

export const publishingCapabilities: PublishingCapability[] = [
  { slug: "manual-export", label: "Manual export", state: "manual-export", canSchedule: false, canPublishImages: true, canPublishVideo: false, note: "Works now: download images and copy captions after approval." },
  { slug: "instagram", label: "Instagram", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned until credentials and Meta app review are configured." },
  { slug: "facebook-pages", label: "Facebook Pages", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned for page-connected accounts." },
  { slug: "threads", label: "Threads", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned; requires official platform access." },
  { slug: "x", label: "X", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned; awaiting API credentials and quota." },
  { slug: "bluesky", label: "Bluesky", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned via AT Protocol credentials." },
  { slug: "mastodon", label: "Mastodon", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned per-instance OAuth setup." },
  { slug: "linkedin", label: "LinkedIn", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned; requires organization/person authorization." },
  { slug: "pinterest", label: "Pinterest", state: "planned", canSchedule: true, canPublishImages: true, canPublishVideo: false, note: "Planned; depends on approved API access." },
  { slug: "tiktok", label: "TikTok", state: "blocked", canSchedule: false, canPublishImages: false, canPublishVideo: true, note: "Blocked for this private utility; no browser automation or unapproved Direct Post access." },
  { slug: "youtube-shorts", label: "YouTube Shorts", state: "planned", canSchedule: true, canPublishImages: false, canPublishVideo: true, note: "Planned for future video rendering, not active in the MVP." }
];

export const manualExportAdapter: PublishingAdapter = {
  capability: publishingCapabilities[0],
  prepareManualExport(input) {
    return { copyCaption: input.caption, downloadUrl: input.imageUrl, altText: input.altText };
  }
};
