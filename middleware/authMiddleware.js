module.exports = function requireStudent(req, res, next) {
  if (!req.session.username) return res.status(401).json({ error: 'login' });
  next();
};
