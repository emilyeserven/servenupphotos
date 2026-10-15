import dummyData from "@/data/dummy.json";

export interface DummyPhoto {
  id: number;
  title: string;
  camera: string;
  takenAt: Date;
  location: string;
  latitude: number;
  longitude: number;
}

// Temporary dummy data until real photos are wired up: about two years of shoot days, each with a
// handful of photos taken around one city.
export const dummyPhotos: DummyPhoto[] = dummyData.map((photo) => ({
  ...photo,
  takenAt: new Date(photo.takenAt),
}));
