const keys = {
  theme: "meals.theme"
};

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  loadTheme: () => safeRead<string>(keys.theme),
  saveTheme: (value: string) => safeWrite(keys.theme, value)
};
