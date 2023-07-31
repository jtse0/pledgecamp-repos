const idsToInt = (req, res, next) => {
  if (req.params.user_id) {
    req.params.user_id = parseInt(req.params.user_id);
  }
  if (req.params.project_id) {
    req.params.project_id = parseInt(req.params.project_id);
  }
  next();
};

module.exports = {
  idsToInt,
};
