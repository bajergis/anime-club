import { db } from '../db.js';

// Requires AniList login, but does not require group membership.
export function requireUser(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

// Requires full group member session.
export function requireAuth(req, res, next) {
  if (!req.session.memberId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const member = db.prepare(`
    SELECT m.group_id
    FROM members m
    WHERE m.id = ?
  `).get(req.session.memberId);

  if (!member) {
    return res.status(403).json({ error: 'Member not found' });
  }

  req.groupId = Number(member.group_id);
  next();
}

// Requires full group member session AND verifies membership via DB (not session).
export function requireGroupMember(req, res, next) {
  if (!req.session.memberId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const member = db.prepare(`
    SELECT m.group_id
    FROM members m
    JOIN group_members gm ON gm.user_id = m.user_id AND gm.group_id = m.group_id
    WHERE m.id = ?
  `).get(req.session.memberId);

  if (!member) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  req.userId = req.session.userId;
  req.groupId = Number(member.group_id);
  next();
}