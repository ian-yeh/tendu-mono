import { useState, useEffect } from "react";

// Define the structure of a session object
interface Session {
  id: string;
  summary: string;
}

const STORAGE_KEY = 'sessions';

// Custom hook to manage session data
export function useData() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    // Initialize state with data from localStorage if it exists
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch (error) {
        console.error('Failed to parse sessions from localStorage:', error);
        return [];
      }
    }
    return [];
  });

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      } catch (error) {
        console.error('Failed to save sessions to localStorage:', error);
      }
    }
  }, [sessions]);

  // Add a new session
  const addSession = (session: Session) => {
    setSessions((prev) => [...prev, session]);
  };

  return { sessions, addSession };
}