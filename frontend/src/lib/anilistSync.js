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
              MediaList(userName: $username, mediaId: $mediaId) {
                progress
                status
                score(format: POINT_10_DECIMAL)
              }
            }`,
            variables: { username: member.anilist_username, mediaId: a.anilist_id },
          }),
          credentials: "include",
        }).then(r => r.json()).catch(() => null);

        const entry = res?.data?.MediaList;
        if (!entry) return null;

        const status = STATUS_MAP[entry.status] || a.status;

        // If AniList says completed but progress is behind total_episodes,
        // use total_episodes so the member page shows the correct count
        let episodes_watched = entry.progress;
        if (
          entry.status === "COMPLETED" &&
          a.total_episodes &&
          (entry.progress == null || entry.progress < a.total_episodes)
        ) {
          episodes_watched = a.total_episodes;
        }

        // Only include rating if AniList has one (non-zero score)
        const rating = entry.score && entry.score > 0 ? entry.score : null;

        return {
          id: a.id,
          episodes_watched,
          status,
          // Only pass rating if there's something to write — don't overwrite
          // a manually entered rating with null
          ...(rating != null ? { rating } : {}),
        };
      })
  );

  return updates.filter(Boolean);
}

export async function applySync(updates, API) {
  return Promise.all(
    updates.map(u =>
      fetch(`${API}/assignments/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodes_watched: u.episodes_watched,
          status: u.status,
          ...(u.rating != null ? { rating: u.rating } : {}),
        }),
        credentials: "include",
      })
    )
  );
}