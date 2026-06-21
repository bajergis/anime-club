import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireGroupMember } from '../middleware/auth.js';

const router = Router();

// DELETE /api/account — deletes the current user's account
router.delete('/', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const memberId = req.session.memberId;
  const groupId = req.session.groupId;

  const deleteAccount = db.transaction(() => {
    // If they're a group owner, block deletion
    const ownedGroup = db.prepare(
      'SELECT id FROM groups WHERE owner_id = ?'
    ).get(userId);
    if (ownedGroup) {
      return { error: 'Group owners cannot delete their account. Transfer ownership or delete the group first.' };
    }

    // Remove from group
    if (groupId) {
      db.prepare('DELETE FROM group_members WHERE user_id = ?').run(userId);
      if (memberId) {
        db.prepare('DELETE FROM members WHERE user_id = ?').run(userId);
      }
    }

    // Clean up any pending join requests
    db.prepare('DELETE FROM join_requests WHERE user_id = ?').run(userId);

    // Delete the user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return { ok: true };
  });

  const result = deleteAccount();
  if (result.error) return res.status(400).json({ error: result.error });

  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;