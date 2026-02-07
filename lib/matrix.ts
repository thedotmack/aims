// Matrix Client Helper — simple fetch()-based, no SDK

const SYNAPSE_URL = process.env.MATRIX_HOMESERVER_URL || "http://localhost:8008";
const SYNAPSE_ADMIN_TOKEN = process.env.MATRIX_ADMIN_TOKEN || "";
const SERVER_NAME = process.env.MATRIX_SERVER_NAME || "aims.bot";

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

// Internal password generator
function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let pw = "";
  for (let i = 0; i < 32; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

export { generatePassword };

/**
 * Create a Matrix user via Synapse admin API.
 * Returns the generated password along with matrixId.
 */
export async function createMatrixUser(
  username: string,
  displayName: string,
  password: string
): Promise<{ matrixId: string }> {
  const matrixId = `@${username}:${SERVER_NAME}`;
  await matrixFetch(
    `/_synapse/admin/v2/users/${encodeURIComponent(matrixId)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${SYNAPSE_ADMIN_TOKEN}` },
      body: JSON.stringify({
        password,
        displayname: displayName || username,
        user_type: "bot",
        admin: false,
      }),
    }
  );
  return { matrixId };
}

/**
 * Login as a Matrix user, returns access token.
 */
export async function loginMatrixUser(username: string, password: string): Promise<string> {
  const data = await matrixFetch("/_matrix/client/v3/login", {
    method: "POST",
    body: JSON.stringify({
      type: "m.login.password",
      user: username,
      password,
    }),
  });
  return data.access_token as string;
}

/**
 * Set user presence on Matrix.
 */
export async function setPresence(
  accessToken: string,
  userId: string,
  presence: "online" | "offline" | "unavailable",
  statusMsg?: string
): Promise<void> {
  const body: Record<string, string> = { presence };
  if (statusMsg !== undefined) body.status_msg = statusMsg;
  await matrixFetch(
    `/_matrix/client/v3/presence/${encodeURIComponent(userId)}/status`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }
  );
}

/**
 * Get user presence from Matrix.
 */
export async function getPresence(
  accessToken: string,
  userId: string
): Promise<{ presence: string; status_msg?: string; last_active_ago?: number }> {
  const data = await matrixFetch(
    `/_matrix/client/v3/presence/${encodeURIComponent(userId)}/status`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return {
    presence: data.presence as string,
    status_msg: data.status_msg as string | undefined,
    last_active_ago: data.last_active_ago as number | undefined,
  };
}

/**
 * Set display name on Matrix.
 */
export async function setDisplayName(
  accessToken: string,
  userId: string,
  displayName: string
): Promise<void> {
  await matrixFetch(
    `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/displayname`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ displayname: displayName }),
    }
  );
}

/**
 * Set avatar URL on Matrix.
 */
export async function setAvatarUrl(
  accessToken: string,
  userId: string,
  avatarUrl: string
): Promise<void> {
  await matrixFetch(
    `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/avatar_url`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ avatar_url: avatarUrl }),
    }
  );
}

/**
 * Create a DM room between two Matrix users.
 */
export async function createDMRoom(accessToken: string, inviteUserId: string): Promise<string> {
  const data = await matrixFetch("/_matrix/client/v3/createRoom", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      is_direct: true,
      invite: [inviteUserId],
      preset: "trusted_private_chat",
    }),
  });
  return data.room_id as string;
}

/**
 * Join a Matrix room (accept invite).
 */
export async function joinRoom(accessToken: string, roomId: string): Promise<void> {
  await matrixFetch(`/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({}),
  });
}

/**
 * Send a text message to a Matrix room.
 */
export async function sendRoomMessage(accessToken: string, roomId: string, text: string): Promise<string> {
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
 * Get messages from a Matrix room.
 */
export async function getRoomMessages(
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
  messages.reverse(); // chronological order
  return messages;
}

/**
 * Get user profile from Matrix.
 */
export async function getUserProfile(
  userId: string
): Promise<{ displayname?: string; avatar_url?: string }> {
  const data = await matrixFetch(
    `/_matrix/client/v3/profile/${encodeURIComponent(userId)}`
  );
  return {
    displayname: data.displayname as string | undefined,
    avatar_url: data.avatar_url as string | undefined,
  };
}
