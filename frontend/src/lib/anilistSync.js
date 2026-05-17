const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const STATUS_MAP = {
  CURRENT: "watching",
  COMPLETED: "completed",
  DROPPED: "dropped",
  PAUSED: "hiatus",
  PLANNING: "pending",
};

export async function syncAniListProgress(assignments, members) {
  const updates = await Promise.all(
    assignments
      .filter(a => a.anilist_id)
      .map(async a => {
        const member = members.find(m => m.name === a.assignee_name);
        if (!member?.anilist_username) return null;
        const res = await fetch(`${API}/anime/anilist-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query($username: String, $mediaId: Int) {
              MediaList(userName: $username, mediaId: $mediaId) { progress status }
            }`,
            variables: { username: member.anilist_username, mediaId: a.anilist_id },
          }),
          credentials: "include",
        }).then(r => r.json()).catch(() => null);
        const entry = res?.data?.MediaList;
        if (!entry) return null;
        return {
          id: a.id,
          episodes_watched: entry.progress,
          status: STATUS_MAP[entry.status] || a.status,
        };
      })
  );
  return updates.filter(Boolean);
}

export async function applySync(updates, API) {
  return Promise.all(updates.map(u =>
    fetch(`${API}/assignments/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodes_watched: u.episodes_watched, status: u.status }),
      credentials: "include",
    })
  ));
}