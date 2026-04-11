import { useCallback, useState } from "react";
import { getSpotifyDevices, transferSpotifyPlayback } from "../api/spotify";

interface SpotifyDevice {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
}

interface UseSpotifyConnectReturn {
    devices: SpotifyDevice[];
    loading: boolean;
    error: string | null;
    refreshDevices: () => Promise<void>;
    transferPlayback: (deviceId: string) => Promise<void>;
}

export function useSpotifyConnect(enabled: boolean): UseSpotifyConnectReturn {
    const [devices, setDevices] = useState<SpotifyDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshDevices = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        setError(null);
        try {
            const result = await getSpotifyDevices();
            setDevices(result.devices);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to get devices");
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    const transferPlayback = useCallback(
        async (deviceId: string) => {
            if (!enabled) return;
            setLoading(true);
            setError(null);
            try {
                await transferSpotifyPlayback(deviceId);
                await refreshDevices();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to transfer playback");
            } finally {
                setLoading(false);
            }
        },
        [enabled, refreshDevices]
    );

    return { devices, loading, error, refreshDevices, transferPlayback };
}
