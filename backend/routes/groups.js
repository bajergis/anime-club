import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember, requireUser } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

router.use((req, res, next) => {
  console.log(`[groups] ${req.method} ${req.path}`);
  next();
});

// ── GET /api/groups/search?q= ─────────────────────────────────
router.get('/search', requireUser, (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);

  const results = db.prepare(`
    SELECT g.id, g.name,
      COUNT(DISTINCT gm.user_id) AS member_count,
      COUNT(DISTINCT s.id) AS season_count
    FROM groups g
    LEFT JOIN group_members gm ON gm.group_id = g.id
    LEFT JOIN seasons s ON s.group_id = g.id
    WHERE g.name LIKE ?
    GROUP BY g.id
    ORDER BY member_count DESC
    LIMIT 20
  `).all(`%${q.trim()}%`);

  res.json(results);
});

// ── GET /api/groups/join?token= ───────────────────────────────
router.get('/join', requireUser, (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'No token provided' });

  const invite = db.prepare(`
    SELECT gi.*, g.name AS group_name,
      COUNT(DISTINCT gm.user_id) AS member_count
    FROM group_invites gi
    JOIN groups g ON g.id = gi.group_id
    LEFT JOIN group_members gm ON gm.group_id = g.id
    WHERE gi.token = ?
    GROUP BY gi.id
  `).get(token);

  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.used_at) return res.status(410).json({ error: 'Invite has already been used' });
  if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });

  res.json({
    group_id: invite.group_id,
    group_name: invite.group_name,
    member_count: invite.member_count,
  });
});

// ── POST /api/groups — create a group ────────────────────────
router.post('/', requireUser, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });

  const userId = req.session.userId;

  const existing = db.prepare(
    'SELECT 1 FROM group_members WHERE user_id = ?'
  ).get(userId);
  if (existing) return res.status(409).json({ error: 'You are already in a group' });

  const createGroup = db.transaction(() => {
    const groupResult = db.prepare(
      `INSERT INTO groups (name, owner_id, created_at) VALUES (?, ?, datetime('now'))`
    ).run(name.trim(), userId);
    const groupId = groupResult.lastInsertRowid;

    db.prepare(
      `INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, datetime('now'))`
    ).run(groupId, userId);

    const username = req.session.anilistUsername;
    const avatarUrl = req.session.avatarUrl;

    db.prepare(`
      INSERT INTO members (id, name, anilist_username, avatar_url, group_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, username, username, avatarUrl, groupId, userId);

    return { groupId, username };
  });

  const { groupId, username } = createGroup();

  req.session.memberId = username;
  req.session.memberName = username;
  req.session.groupId = groupId;

  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    res.status(201).json({ group_id: groupId });
  });
});

// ── POST /api/groups/join — consume invite token ──────────────
router.post('/join', requireUser, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token provided' });

  const userId = req.session.userId;

  const invite = db.prepare(
    'SELECT * FROM group_invites WHERE token = ?'
  ).get(token);

  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.used_at) return res.status(410).json({ error: 'Invite already used' });
  if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });

  const existing = db.prepare(
    'SELECT 1 FROM group_members WHERE user_id = ?'
  ).get(userId);
  if (existing) return res.status(409).json({ error: 'You are already in a group' });

  const joinGroup = db.transaction(() => {
    const username = req.session.anilistUsername;
    const avatarUrl = req.session.avatarUrl;

    db.prepare(
      `INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, datetime('now'))`
    ).run(invite.group_id, userId);

    db.prepare(`
      INSERT INTO members (id, name, anilist_username, avatar_url, group_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, username, username, avatarUrl, invite.group_id, userId);

    db.prepare(`
      UPDATE group_invites SET used_at = datetime('now'), used_by = ? WHERE token = ?
    `).run(userId, token);

    return { groupId: invite.group_id, username };
  });

  const { groupId, username } = joinGroup();

  req.session.memberId = username;
  req.session.memberName = username;
  req.session.groupId = groupId;

  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    res.json({ ok: true, group_id: groupId });
  });
});

// ── POST /api/groups/:id/request ──────────────────────────────
router.post('/:id/request', requireUser, (req, res) => {
  const userId = req.session.userId;

  const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const existing = db.prepare(
    'SELECT 1 FROM group_members WHERE user_id = ?'
  ).get(userId);
  if (existing) return res.status(409).json({ error: 'Already in a group' });

  const alreadyRequested = db.prepare(
    `SELECT 1 FROM join_requests WHERE user_id = ? AND group_id = ? AND status = 'pending'`
  ).get(userId, req.params.id);
  if (alreadyRequested) return res.status(409).json({ error: 'Request already pending' });

  db.prepare(`
    INSERT INTO join_requests (group_id, user_id, anilist_username, avatar_url, requested_at, status)
    VALUES (?, ?, ?, ?, datetime('now'), 'pending')
  `).run(req.params.id, userId, req.session.anilistUsername, req.session.avatarUrl);

  res.json({ ok: true });
});

// ── GET /api/groups/:id/requests ──────────────────────────────
router.get('/:id/requests', requireAuth, requireGroupMember, (req, res) => {
  if (Number(req.params.id) !== req.groupId) return res.status(403).json({ error: 'Forbidden' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.owner_id !== req.userId) return res.status(403).json({ error: 'Not the group owner' });

  const requests = db.prepare(`
    SELECT * FROM join_requests
    WHERE group_id = ? AND status = 'pending'
    ORDER BY requested_at ASC
  `).all(req.params.id);

  res.json(requests);
});

// ── PATCH /api/groups/:id/requests/:requestUserId ─────────────
router.patch('/:id/requests/:requestUserId', requireAuth, requireGroupMember, (req, res) => {
  if (Number(req.params.id) !== req.groupId) return res.status(403).json({ error: 'Forbidden' });

  const { action } = req.body;
  if (!['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.owner_id !== req.userId) return res.status(403).json({ error: 'Not the group owner' });

  const request = db.prepare(
    `SELECT * FROM join_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'`
  ).get(req.params.id, req.params.requestUserId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  if (action === 'reject') {
    db.prepare(
      `UPDATE join_requests SET status = 'rejected' WHERE group_id = ? AND user_id = ?`
    ).run(req.params.id, req.params.requestUserId);
    return res.json({ ok: true });
  }

  const acceptRequest = db.transaction(() => {
    db.prepare(
      `INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, datetime('now'))`
    ).run(req.params.id, req.params.requestUserId);

    db.prepare(`
      INSERT INTO members (id, name, anilist_username, avatar_url, group_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      request.anilist_username,
      request.anilist_username,
      request.anilist_username,
      request.avatar_url,
      req.params.id,
      req.params.requestUserId,
    );

    db.prepare(
      `UPDATE join_requests SET status = 'accepted' WHERE group_id = ? AND user_id = ?`
    ).run(req.params.id, req.params.requestUserId);
  });

  acceptRequest();
  res.json({ ok: true });
});

// ── POST /api/groups/:id/invite ───────────────────────────────
router.post('/:id/invite', requireAuth, requireGroupMember, (req, res) => {
  if (Number(req.params.id) !== req.groupId) return res.status(403).json({ error: 'Forbidden' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.owner_id !== req.userId) return res.status(403).json({ error: 'Not the group owner' });

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO group_invites (token, group_id, created_by, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, req.params.id, req.session.userId, expiresAt);

  const inviteUrl = `${process.env.FRONTEND_URL}/join?token=${token}`;
  res.json({ token, invite_url: inviteUrl, expires_at: expiresAt });
});

// ── DELETE /api/groups/:id/members/:memberId ──────────────────
router.delete('/:id/members/:memberId', requireAuth, requireGroupMember, (req, res) => {
  if (Number(req.params.id) !== req.groupId) return res.status(403).json({ error: 'Forbidden' });

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.owner_id !== req.userId) return res.status(403).json({ error: 'Not the group owner' });
  if (req.params.memberId === req.session.memberId) return res.status(400).json({ error: "Can't remove yourself" });

  const removeMember = db.transaction(() => {
    const member = db.prepare(
      'SELECT user_id FROM members WHERE id = ? AND group_id = ?'
    ).get(req.params.memberId, req.params.id);
    if (!member) return false;

    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(req.params.id, member.user_id);
    db.prepare('DELETE FROM members WHERE id = ? AND group_id = ?').run(req.params.memberId, req.params.id);
    return true;
  });

  const removed = removeMember();
  if (!removed) return res.status(404).json({ error: 'Member not found' });
  res.json({ ok: true });
});

// ── GET /api/groups/:id — must be last ────────────────────────
router.get('/:id', (req, res) => {
  const group = db.prepare(`
    SELECT g.id, g.name,
      COUNT(DISTINCT gm.user_id) AS member_count,
      COUNT(DISTINCT s.id) AS season_count
    FROM groups g
    LEFT JOIN group_members gm ON gm.group_id = g.id
    LEFT JOIN seasons s ON s.group_id = g.id
    WHERE g.id = ?
    GROUP BY g.id
  `).get(req.params.id);

  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json(group);
});

export default router;