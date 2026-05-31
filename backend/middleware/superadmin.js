// middleware/superadmin.js
// Restricts access to the site owner only via ADMIN_USER_IDS env var.

export function requireSuperAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const adminIds = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (!adminIds.includes(req.session.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}