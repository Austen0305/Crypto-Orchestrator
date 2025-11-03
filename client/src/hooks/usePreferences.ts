import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { Theme, UserPreferences, UpdatePreferencesData } from '../../../shared/types';
import { apiRequest } from '../lib/queryClient';

// Types imported from shared/types.ts

export function usePreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest('GET', '/api/preferences');
      const data = await response.json();
      setPreferences(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: UpdatePreferencesData) => {
    try {
      const response = await apiRequest('PUT', '/api/preferences', updates);
      const data = await response.json();
      setPreferences(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('Failed to update preferences:', err);
      setError('Failed to update preferences');
      throw err;
    }
  }, []);

  // Update theme specifically
  const updateTheme = useCallback(async (theme: Theme) => {
    try {
      await apiRequest('PATCH', '/api/preferences/theme', { theme });
      setPreferences(prev => prev ? { ...prev, theme } : null);
      setError(null);
    } catch (err) {
      console.error('Failed to update theme:', err);
      setError('Failed to update theme');
      throw err;
    }
  }, []);

  // Reset preferences to defaults
  const resetPreferences = useCallback(async () => {
    try {
      const response = await apiRequest('POST', '/api/preferences/reset');
      const data = await response.json();
      setPreferences(data.preferences);
      setError(null);
      return data.preferences;
    } catch (err) {
      console.error('Failed to reset preferences:', err);
      setError('Failed to reset preferences');
      throw err;
    }
  }, []);

  // Load preferences on mount and when user changes
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    updateTheme,
    resetPreferences,
    reloadPreferences: loadPreferences,
  };
}