import { db } from '../db.js';

// Requires AniList login, but does not require group membership.
// Use this for: create group, invite join, group search, request to join.
export function requireUser(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  next();
}

// Requires full group member session.
// Use this for normal app routes after user has joined a group.
export function requireAuth(req, res, next) {
  if (!req.session.memberId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  next();
}

// Rejects requests where the logged-in member is not in the group that owns the resource being accessed.
export function requireGroupMember(req, res, next) {
  if (!req.session.memberId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const groupId = req.session.groupId;

  if (!groupId) {
    return res.status(400).json({ error: 'No group context' });
  }

  const membership = db.prepare(`
    SELECT 1
    FROM group_members gm
    JOIN members m ON m.user_id = gm.user_id
    WHERE m.id = ? AND gm.group_id = ?
  `).get(req.session.memberId, groupId);

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  req.groupId = Number(groupId);
  next();
}