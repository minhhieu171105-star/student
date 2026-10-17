module.exports = function requireStudent(req, res, next) {
  if (!req.session.username) {
    if (req.method === 'GET') return res.redirect('/');
    return res.status(401).json({ error: 'login' });
  }
  next();
};
