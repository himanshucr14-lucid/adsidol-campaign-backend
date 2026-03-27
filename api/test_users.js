const { USERS } = require('../lib/users');
module.exports = (req, res) => {
    res.status(200).json({ ok: true, count: USERS.length });
};
