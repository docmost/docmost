export type UnsplashApiPhoto = {
  id: string;
  description: string | null;
  alt_description: string | null;
  color: string | null;
  premium?: boolean;
  plus?: boolean;
  urls: { raw: string; small: string };
  links: { download_location: string };
  user: { name: string; username: string };
};

export type UnsplashPhoto = {
  id: string;
  description: string | null;
  color: string | null;
  thumbUrl: string;
  coverUrl: string;
  authorName: string;
  authorUsername: string;
};

// cached per photo, the download link never leaves the server
export type UnsplashPhotoRecord = UnsplashPhoto & { downloadLocation: string };

export type UnsplashPhotoList = {
  items: UnsplashPhoto[];
  hasMore: boolean;
};

export type UnsplashPhotoPage = {
  photos: UnsplashPhotoRecord[];
  hasMore: boolean;
};

export type UnsplashCoverBudget = { used: number; resetAt: number };

export type UnsplashAttribution = {
  source: 'unsplash';
  photoId: string;
  authorName: string;
  authorUsername: string;
};

export type UnsplashCover = {
  coverPhoto: string;
  coverAttribution: UnsplashAttribution;
};
