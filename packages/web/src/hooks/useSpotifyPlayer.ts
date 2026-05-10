import { useCallback, useEffect, useRef, useState } from "react";
import { getSpotifyToken } from "../api/spotify";

interface SpotifyPlayer {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, callback: (state: any) => void): void;
    removeListener(event: string, callback?: (state: any) => void): void;
    getCurrentState(): Promise<SpotifyPlaybackState | null>;
    setName(name: string): Promise<void>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
    activateElement(): Promise<void>;
}

interface SpotifyPlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
        current_track: {
            id: string;
            uri: string;
            name: string;
            artists: { name: string }[];
            album: { name: string; images: { url: string }[] };
            duration_ms: number;
        };
    };
}

interface SpotifyPlayerInit {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
}

declare global {
    interface Window {
        Spotify: {
            Player: new (options: SpotifyPlayerInit) => SpotifyPlayer;
        };
        onSpotifyWebPlaybackSDKReady: () => void;
    }
}

interface UseSpotifyPlayerReturn {
    isReady: boolean;
    deviceId: string | null;
    playerState: SpotifyPlaybackState | null;
    error: string | null;
    play: (spotifyUri: string) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    seek: (positionMs: number) => Promise<void>;
    setVolume: (volume: number) => Promise<void>;
    disconnect: () => void;
}

let sdkScriptLoaded = false;

function loadSpotifySDK(): Promise<void> {
    if (sdkScriptLoaded || window.Spotify) return Promise.resolve();
    return new Promise((resolve) => {
        sdkScriptLoaded = true;
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        window.onSpotifyWebPlaybackSDKReady = () => resolve();
        document.body.appendChild(script);
    });
}

export function useSpotifyPlayer(enabled: boolean): UseSpotifyPlayerReturn {
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [playerState, setPlayerState] = useState<SpotifyPlaybackState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const tokenRef = useRef<string | null>(null);

    const fetchToken = useCallback(async (): Promise<string> => {
        const { accessToken } = await getSpotifyToken();
        tokenRef.current = accessToken;
        return accessToken;
    }, []);

    useEffect(() => {
        if (!enabled) {
            playerRef.current?.disconnect();
            playerRef.current = null;
            setIsReady(false);
            setDeviceId(null);
            setPlayerState(null);
            return;
        }

        let cancelled = false;

        async function init() {
            try {
                await loadSpotifySDK();
                if (cancelled) return;

                const player = new window.Spotify.Player({
                    name: "PlayPlay Venue",
                    getOAuthToken: async (cb: (token: string) => void) => {
                        try {
                            const token = await fetchToken();
                            cb(token);
                        } catch {
                            setError("Failed to get Spotify token");
                        }
                    },
                    volume: 0.8,
                });

                player.addListener("ready", ({ device_id }: { device_id: string }) => {
                    if (cancelled) return;
                    setDeviceId(device_id);
                    setIsReady(true);
                    setError(null);
                });

                player.addListener("not_ready", () => {
                    if (cancelled) return;
                    setIsReady(false);
                    setDeviceId(null);
                });

                player.addListener("player_state_changed", (state: SpotifyPlaybackState | null) => {
                    if (cancelled) return;
                    setPlayerState(state);
                });

                player.addListener("initialization_error", ({ message }: { message: string }) => {
                    if (cancelled) return;
                    setError(`Initialization error: ${message}`);
                });

                player.addListener("authentication_error", ({ message }: { message: string }) => {
                    if (cancelled) return;
                    setError(`Authentication error: ${message}`);
                });

                player.addListener("account_error", ({ message }: { message: string }) => {
                    if (cancelled) return;
                    setError(`Account error: ${message}. Spotify Premium is required.`);
                });

                player.addListener("playback_error", ({ message }: { message: string }) => {
                    if (cancelled) return;
                    setError(`Playback error: ${message}`);
                });

                const connected = await player.connect();
                if (!connected) {
                    setError("Failed to connect to Spotify");
                    return;
                }

                playerRef.current = player;
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to initialize Spotify player");
                }
            }
        }

        init();

        return () => {
            cancelled = true;
            playerRef.current?.disconnect();
            playerRef.current = null;
            setIsReady(false);
            setDeviceId(null);
        };
    }, [enabled, fetchToken]);

    const play = useCallback(
        async (spotifyUri: string) => {
            if (!deviceId) return;
            const playUrl = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
            const transferUrl = "https://api.spotify.com/v1/me/player";
            const body = JSON.stringify({ uris: [spotifyUri] });

            // Always fetch a fresh token — the cached one may have expired
            // (Spotify access tokens last ~1h) which surfaces as a 403/401 on
            // the play call and leaves the previous track loaded on the device.
            let token: string;
            try {
                token = await fetchToken();
            } catch {
                setError("Failed to get Spotify token");
                return;
            }

            const authHeaders = () => ({
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            });

            const transferToDevice = () =>
                fetch(transferUrl, {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify({ device_ids: [deviceId], play: false }),
                });

            const doPlay = () =>
                fetch(playUrl, { method: "PUT", headers: authHeaders(), body });

            let resp = await doPlay();

            if (resp.status === 401) {
                try {
                    token = await fetchToken();
                } catch {
                    setError("Failed to refresh Spotify token");
                    return;
                }
                resp = await doPlay();
            }

            // 403 "Restriction violated" usually means another Connect device
            // owns playback. Transfer to our SDK device, then retry.
            if (resp.status === 403 || resp.status === 404) {
                await transferToDevice().catch(() => {});
                // Spotify needs a brief moment to register the transfer.
                await new Promise((r) => setTimeout(r, 400));
                resp = await doPlay();
            }

            if (!resp.ok) {
                const text = await resp.text().catch(() => "");
                setError(`Spotify play failed (${resp.status}): ${text || resp.statusText}`);
            }
        },
        [deviceId, fetchToken]
    );

    const pause = useCallback(async () => {
        await playerRef.current?.pause();
    }, []);

    const resume = useCallback(async () => {
        await playerRef.current?.resume();
    }, []);

    const seek = useCallback(async (positionMs: number) => {
        await playerRef.current?.seek(positionMs);
    }, []);

    const setVolume = useCallback(async (volume: number) => {
        await playerRef.current?.setVolume(volume);
    }, []);

    const disconnect = useCallback(() => {
        playerRef.current?.disconnect();
        playerRef.current = null;
        setIsReady(false);
        setDeviceId(null);
    }, []);

    return {
        isReady,
        deviceId,
        playerState,
        error,
        play,
        pause,
        resume,
        seek,
        setVolume,
        disconnect,
    };
}
