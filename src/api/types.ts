export interface Film {
  views?: number;
  loves?: number;
  trailer?: { assetId:string; durationSeconds: number } | null;
  id: string;
  title: string;
  synopsis: string | null;
  year: number | null;
  genres: string[];
  ageRating: string | null;
  durationSeconds: number;
  posterUrl: string | null;
}
export interface Part {
  isReel?:boolean;
  views?: number;
  id: string;
  position: number;
  title: string;
  description: string | null;
  durationSeconds: number;
  accessPolicy: 'free' | 'premium' | 'rewarded_ad';
  previewAllowed: boolean;
  previewSeconds: number;
}
export type ReelItem={film:Film;part:Part};
export interface FilmDetail {
  film: Film;
  parts: Part[];
}
export interface Playback {
  url: string;
  expiresAt: string;
  durationSeconds: number;
  preview: boolean;
}
export interface Credentials {
  recoveryToken?: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  userId: string;
  deviceId: string;
}
