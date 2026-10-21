module.exports = function requireStudent(req, res, next) {
  if (!req.session.ten_dang_nhap) {
    if (req.method === 'GET') return res.redirect('/');
    return res.status(401).json({ error: 'login' });
  }
  next();
};
