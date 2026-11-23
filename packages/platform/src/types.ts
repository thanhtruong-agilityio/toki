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

// What one tab tells the others of the same browser. It carries no name, no
// address and no id.
export type TabMessage = { type: "signedOut" };

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
  tabs: {
    // Sends to every other tab and window of the browser, never to this one.
    post(message: TabMessage): void;
    // Calls the listener for each message another tab sends; returns the stop.
    subscribe(listener: (message: TabMessage) => void): () => void;
  };
};
