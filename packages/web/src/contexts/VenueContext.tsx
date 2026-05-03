import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getVenueInfo } from "../api/auth";

interface VenueInfo {
  name: string;
  slug: string;
  requiresVenueCode: boolean;
}

interface VenueContextValue {
  venue: VenueInfo | null;
  loading: boolean;
  error: string | null;
}

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider({ children }: { children: ReactNode }) {
  const [venue, setVenue] = useState<VenueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVenueInfo()
      .then((info) => {
        setVenue(info);
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load venue info",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <VenueContext.Provider value={{ venue, loading, error }}>
      {children}
    </VenueContext.Provider>
  );
}

export function useVenue(): VenueContextValue {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error("useVenue must be used within VenueProvider");
  return ctx;
}
