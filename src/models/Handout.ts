export type HandoutCategory = "letter" | "clue" | "portrait" | "document" | "illustration" | "other";

export interface Handout {
  id: string;
  title: string;
  description: string;
  category: HandoutCategory;
  recipientUserId: string | null;
  recipientUsername: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  assetVersion: number;
  isPublished: boolean;
  isFeatured: boolean;
  revealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HandoutRecipient {
  id: string;
  username: string;
}

export interface HandoutInput {
  title: string;
  description: string;
  category: HandoutCategory;
  recipientUserId: string | null;
  isPublished: boolean;
  isFeatured: boolean;
}

