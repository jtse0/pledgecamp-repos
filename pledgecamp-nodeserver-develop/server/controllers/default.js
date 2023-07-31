const healthCheck = (req, res) => {
  res.status(200).json({
    name: process.env.npm_package_name,
    description: process.env.npm_package_description,
    version: process.env.npm_package_version,
    author: process.env.npm_package_author_name,
    contact: process.env.npm_package_author_email,
  });
};

module.exports = {
  healthCheck,
};
