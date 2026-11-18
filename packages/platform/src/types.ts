export type StorageArea = {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  clear(): void;
};

export type NotificationPermissionState =
  "unsupported" | "default" | "granted" | "denied";

export type PickedFile = {
  name: string;
  size: number;
  mimeType: string;
  handle: unknown;
};

export type SoundName = "notification";

export type Platform = {
  notifications: {
    permission(): NotificationPermissionState;
    requestPermission(): Promise<NotificationPermissionState>;
  };
  storage: { device: StorageArea; tab: StorageArea };
  files: {
    pick(options?: {
      multiple?: boolean;
      accept?: string[];
    }): Promise<PickedFile[]>;
  };
  sound: { play(name: SoundName): Promise<boolean> };
};
