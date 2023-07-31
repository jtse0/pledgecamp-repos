const defaultRouter = require('./default');
const monitorRouter = require('./monitor');
const projectsRouter = require('./projects');
const moderatorRouter = require('./moderator');
const managerRouter = require('./manager');
const campsharesRouter = require('./campshares');
const adminRouter = require('./admin');
const rawRouter = require('./raw');

module.exports = (app) => {
  app.use('/', defaultRouter);
  app.use('/api/monitor/', monitorRouter);
  app.use('/api/projects/', projectsRouter);
  app.use('/api/moderator/', moderatorRouter);
  app.use('/api/manager/', managerRouter);
  app.use('/api/cs/', campsharesRouter);
  app.use('/api/admin/', adminRouter);
  app.use('/api/rawTx/', rawRouter);
};
