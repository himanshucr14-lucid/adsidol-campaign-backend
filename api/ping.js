module.exports = (req, res) => {
    res.status(200).json({ ok: true, message: 'Ping successful', timestamp: Date.now() });
};
