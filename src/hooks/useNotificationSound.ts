import { useState, useEffect, useCallback, useRef } from 'react';

// Sound options with different tones
export const NOTIFICATION_SOUNDS = {
  chime: {
    name: 'Chime',
    // Pleasant chime sound
    base64: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYXz2AAAAAAAAAAAAAAAAAAAAAAD/+9DEAAAGtAFptAAAJTITq/c0wAkAAAANIAAAAAEJGJEIhCEIf/LEIQhCEIT//+UIT/KE85znOc5znOc5znOc+c5znOc5znOc5znOc5znOc5znOc5z3EhYWFhYWFhYWFhYX//uxCEIQhCEIQh/5QhCEIQhD/ygAAADSAMYxjGMYxjGHVdV1XVQAAAAD/+9DEDYPQAAGkAAAAIAAANIAAAAT//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////',
  },
  bell: {
    name: 'Bell',
    // Gentle bell sound
    base64: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYXz2AAAAAAAAAAAAAAAAAAAAAAD/+9DEAAAGtANptBAAJUITq/c0wAoAAAANIAAAAAFJOJEIhCEIf/bEIQhCEIT//6UIT/qE85znOc5znOc5znOc+c5znOc5znOc5znOc5znOc5znOc5z3EhYWFhYWFhYWFhYX//uxCEIQhCEIQh/5QhCEIQhD/ygAAADSAMYxjGMYxjGHVdV1XVQAAAAD/+9DEDYPQAAGkAAAAIAAANIAAAAT//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////',
  },
  success: {
    name: 'Success',
    // Uplifting success sound
    base64: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYXz2AAAAAAAAAAAAAAAAAAAAAAD/+9DEAAAGtANptBAAJUITq/c0wAoAAAANIAAAAAFpOJEIhCEIf/bEIQhCEIT//6UIT/qE85znOc5znOc5znOc+c5znOc5znOc5znOc5znOc5znOc5z3EhYWFhYWFhYWFhYX//uxCEIQhCEIQh/5QhCEIQhD/ygAAADSAMYxjGMYxjGHVdV1XVQAAAAD/+9DEDYPQAAGkAAAAIAAANIAAAAT//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////',
  },
  pop: {
    name: 'Pop',
    // Quick pop sound
    base64: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYXz2AAAAAAAAAAAAAAAAAAAAAAD/+9DEAAAGtAFptAAAJTITq/c0wAkAAAANIAAAAAEJGJEIhCEIf/LEIQhCEIT//+UIT/KE85znOc5znOc5znOc+c5znOc5znOc5znOc5znOc5znOc5z3EhYWFhYWFhYWFhYX//uxCEIQhCEIQh/5QhCEIQhD/ygAAADSAMYxjGMYxjGHVdV1XVQAAAAD/+9DEDYPQAAGkAAAAIAAANIAAAAT//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////',
  },
} as const;

export type NotificationSoundType = keyof typeof NOTIFICATION_SOUNDS;

interface NotificationSoundSettings {
  enabled: boolean;
  soundType: NotificationSoundType;
  volume: number;
}

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  soundType: 'chime',
  volume: 0.5,
};

const STORAGE_KEY = 'notificationSoundSettings';

export const useNotificationSound = () => {
  const [settings, setSettings] = useState<NotificationSoundSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playSound = useCallback((overrideSoundType?: NotificationSoundType) => {
    if (!settings.enabled || !audioRef.current) return;

    const soundType = overrideSoundType || settings.soundType;
    const sound = NOTIFICATION_SOUNDS[soundType];

    audioRef.current.src = sound.base64;
    audioRef.current.volume = settings.volume;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err) => {
      console.log('Could not play notification sound:', err);
    });
  }, [settings.enabled, settings.soundType, settings.volume]);

  const toggleSound = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setSoundType = useCallback((soundType: NotificationSoundType) => {
    setSettings(prev => ({ ...prev, soundType }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const testSound = useCallback((soundType?: NotificationSoundType) => {
    const type = soundType || settings.soundType;
    const sound = NOTIFICATION_SOUNDS[type];
    
    if (audioRef.current) {
      audioRef.current.src = sound.base64;
      audioRef.current.volume = settings.volume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log('Could not play test sound:', err);
      });
    }
  }, [settings.soundType, settings.volume]);

  return {
    settings,
    playSound,
    toggleSound,
    setSoundType,
    setVolume,
    testSound,
    isEnabled: settings.enabled,
    soundType: settings.soundType,
    volume: settings.volume,
  };
};
