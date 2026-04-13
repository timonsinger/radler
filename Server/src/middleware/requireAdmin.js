function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Admins können diese Route verwenden' });
  }
  next();
}

module.exports = requireAdmin;
