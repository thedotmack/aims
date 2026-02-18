// Matrix room operations for group chat rooms

const SYNAPSE_URL = process.env.MATRIX_HOMESERVER_URL || "http://localhost:8008";

async function matrixFetch(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(`${SYNAPSE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data.error as string) || `Matrix API error ${res.status}`);
  }
  return data;
}

/**
 * Create a group room on Matrix with the given title and invited users.
 * Uses the creator's access token.
 */
export async function createGroupRoom(
  accessToken: string,
  title: string,
  inviteUserIds: string[]
): Promise<string> {
  const data = await matrixFetch("/_matrix/client/v3/createRoom", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      name: title,
      topic: `AIMS Group Room: ${title}`,
      invite: inviteUserIds,
      preset: "private_chat",
      visibility: "private",
    }),
  });
  return data.room_id as string;
}

/**
 * Join a room (accept invite).
 */
export async function joinGroupRoom(accessToken: string, roomId: string): Promise<void> {
  await matrixFetch(`/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({}),
  });
}

/**
 * Send a text message to a room.
 */
export async function sendGroupMessage(accessToken: string, roomId: string, text: string): Promise<string> {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const data = await matrixFetch(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ msgtype: "m.text", body: text }),
    }
  );
  return data.event_id as string;
}

/**
 * Get messages from a room.
 */
export async function getGroupMessages(
  accessToken: string,
  roomId: string,
  limit: number = 50
): Promise<Array<{ sender: string; body: string; timestamp: number; eventId: string }>> {
  const data = await matrixFetch(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const chunk = (data.chunk as Array<Record<string, unknown>>) || [];
  const messages = chunk
    .filter((e) => e.type === "m.room.message")
    .map((e) => ({
      sender: e.sender as string,
      body: ((e.content as Record<string, unknown>)?.body as string) || "",
      timestamp: (e.origin_server_ts as number) || 0,
      eventId: e.event_id as string,
    }));
  messages.reverse();
  return messages;
}
