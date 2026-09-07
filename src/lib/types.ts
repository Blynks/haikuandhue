export type PoemView = {
  id: string;
  lines: string[];
  syllableCounts?: number[];
  syllableUncertain?: boolean;
};

export type BackgroundView = {
  id: string;
  name: string;
  svgTemplate: string;
};

export type DeliveryView = {
  status: string;
  destination: { label: string };
};

export type RevisionView = {
  id: string;
  revisionNumber?: number;
  status?: string;
  caption: string;
  altText: string;
  scheduledFor?: Date | string | null;
  poem: PoemView;
  background: BackgroundView;
  deliveries?: DeliveryView[];
};

export type DestinationView = {
  id: string;
  slug: string;
  label: string;
  state: string;
  note: string;
};
