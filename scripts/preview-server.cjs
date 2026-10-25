// Safe local design review. Uses synthetic responses and blocks provider traffic.
process.env.LUSTRE_DESIGN_PREVIEW = '1';
require('../tests/server.js');
