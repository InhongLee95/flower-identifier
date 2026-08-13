export type HistoryEntry = {
  id: string;
  imagePath: string;
  flowerName: string;
  description: string;
  createdAt: number;
};

export type IdentifyErrorCode =
  | "NOT_A_FLOWER"
  | "INVALID_FILE"
  | "TIMEOUT"
  | "UPLOAD_FAILED"
  | "AI_ERROR"
  | "RATE_LIMITED"
  | "FORBIDDEN";
