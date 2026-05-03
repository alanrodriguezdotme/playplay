import { apiRequest } from "./client.js";
import type { QueueEntry, QueueResponse, QueueHistoryResponse, DisplaySettings } from "@playplay/shared";

export async function addToQueue(songId?: string, spotifyTrackId?: string): Promise<QueueEntry> {
  return apiRequest<QueueEntry>("/api/queue/add", {
    method: "POST",
    body: JSON.stringify({ songId, spotifyTrackId }),
  });
}

export async function voteOnEntry(
  entryId: string,
  value: 1 | -1 | 0
): Promise<QueueEntry> {
  return apiRequest<QueueEntry>(`/api/queue/${entryId}/vote`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export async function getQueue(): Promise<QueueResponse> {
  return apiRequest<QueueResponse>("/api/queue");
}

export async function getQueueHistory(
  page = 1,
  limit = 50
): Promise<QueueHistoryResponse> {
  return apiRequest<QueueHistoryResponse>(
    `/api/queue/history?page=${page}&limit=${limit}`
  );
}

export async function getNowPlaying(): Promise<QueueEntry | null> {
  return apiRequest<QueueEntry | null>(
    "/api/queue/now-playing"
  );
}

export async function removeFromQueue(entryId: string): Promise<void> {
  await apiRequest(`/api/queue/${entryId}`, { method: "DELETE" });
}

export async function getDisplaySettings(): Promise<DisplaySettings> {
  return apiRequest<DisplaySettings>(
    "/api/queue/display-settings"
  );
}

export async function playNow(entryId: string): Promise<QueueEntry> {
  return apiRequest<QueueEntry>(`/api/queue/${entryId}/play-now`, {
    method: "POST",
  });
}

export async function reorderQueue(entryIds: string[]): Promise<void> {
  await apiRequest("/api/queue/reorder", {
    method: "POST",
    body: JSON.stringify({ entryIds }),
  });
}
