import { Router } from 'express';
import { db } from '../db.js';
import { requireSuperAdmin } from '../middleware/superadmin.js';

const router = Router();

router.use(requireSuperAdmin);

// ── GET /api/superadmin/groups ────────────────────────────────
// All groups with owner info and member count
router.get('/groups', (req, res) => {
  const groups = db.prepare(`
    SELECT
      g.id, g.name, g.created_at,
      u.id AS owner_user_id, u.username AS owner_username,
      u.avatar_url AS owner_avatar,
      u.banned_at AS owner_banned_at,
      COUNT(DISTINCT gm.user_id) AS member_count,
      COUNT(DISTINCT s.id) AS season_count
    FROM groups g
    LEFT JOIN users u ON u.id = g.owner_id
    LEFT JOIN group_members gm ON gm.group_id = g.id
    LEFT JOIN seasons s ON s.group_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all();
  res.json(groups);
});

// ── GET /api/superadmin/groups/:id ───────────────────────────
// Group detail — all members with linked user accounts
router.get('/groups/:id', (req, res) => {
  const group = db.prepare(`
    SELECT g.*, u.username AS owner_username
    FROM groups g
    LEFT JOIN users u ON u.id = g.owner_id
    WHERE g.id = ?
  `).get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db.prepare(`
    SELECT
      m.id AS member_id, m.name, m.anilist_username, m.avatar_url,
      m.group_id, m.user_id,
      u.id AS user_id, u.username, u.banned_at, u.ban_reason,
      u.created_at AS user_created_at,
      COUNT(DISTINCT a.id) AS assignment_count
    FROM members m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN assignments a ON a.assignee_id = m.id
    WHERE m.group_id = ?
    GROUP BY m.id
    ORDER BY m.name ASC
  `).all(req.params.id);

  res.json({ ...group, members });
});

// ── GET /api/superadmin/users ─────────────────────────────────
// All users (for reassign picker)
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.*, g.id AS group_id, g.name AS group_name
    FROM users u
    LEFT JOIN members m ON m.user_id = u.id
    LEFT JOIN groups g ON g.id = m.group_id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// ── POST /api/superadmin/users/:id/ban ───────────────────────
router.post('/users/:id/ban', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { reason } = req.body;

  db.prepare(`
    UPDATE users SET banned_at = datetime('now'), ban_reason = ? WHERE id = ?
  `).run(reason?.trim() || null, req.params.id);

  res.json({ ok: true });
});

// ── DELETE /api/superadmin/users/:id/ban ─────────────────────
router.delete('/users/:id/ban', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ?
  `).run(req.params.id);

  res.json({ ok: true });
});

// ── POST /api/superadmin/members/:memberId/reassign ───────────
// Move a member to a different group.
// - Updates members.group_id
// - Moves group_members row
// - Does NOT touch assignments (history stays)
// - If member was group owner, ownership is NOT transferred (must be done manually)
router.post('/members/:memberId/reassign', (req, res) => {
  const { target_group_id } = req.body;
  if (!target_group_id) return res.status(400).json({ error: 'target_group_id is required' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const targetGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(target_group_id);
  if (!targetGroup) return res.status(404).json({ error: 'Target group not found' });

  if (member.group_id === Number(target_group_id)) {
    return res.status(400).json({ error: 'Member is already in that group' });
  }

  const reassign = db.transaction(() => {
    // Move group_members row
    db.prepare('DELETE FROM group_members WHERE user_id = ? AND group_id = ?').run(member.user_id, member.group_id);
    db.prepare(`
      INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at)
      VALUES (?, ?, datetime('now'))
    `).run(target_group_id, member.user_id);

    // Update member's group
    db.prepare('UPDATE members SET group_id = ? WHERE id = ?').run(target_group_id, req.params.memberId);
  });

  reassign();
  res.json({ ok: true });
});

// ── GET /api/superadmin/stats ─────────────────────────────────
// Site-wide summary stats
router.get('/stats', (req, res) => {
  const stats = {
    total_users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    banned_users: db.prepare('SELECT COUNT(*) AS n FROM users WHERE banned_at IS NOT NULL').get().n,
    total_groups: db.prepare('SELECT COUNT(*) AS n FROM groups').get().n,
    total_members: db.prepare('SELECT COUNT(*) AS n FROM members').get().n,
    total_assignments: db.prepare('SELECT COUNT(*) AS n FROM assignments').get().n,
    total_seasons: db.prepare('SELECT COUNT(*) AS n FROM seasons').get().n,
    total_rolls: db.prepare('SELECT COUNT(*) AS n FROM rolls').get().n,
  };
  res.json(stats);
});

export default router;