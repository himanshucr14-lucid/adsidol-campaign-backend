// lib/store.js
// Persistent follow-up job store using Upstash Redis REST API.
// No SDK needed — plain fetch calls work in Vercel Node.js runtime.
//
// Required env vars:
//   UPSTASH_REDIS_REST_URL   — e.g. https://xxx-yyy.upstash.io
//   UPSTASH_REDIS_REST_TOKEN — your Upstash REST token

const REDIS_URL   = () => process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN;

const JOB_SET_KEY = 'adsidol:jobs'; // Redis Set that holds all job IDs

// ── Low-level Redis command ──────────────────────────────────────────────────
async function redis(...args) {
    const res = await fetch(REDIS_URL(), {
        method:  'POST',
        headers: {
            Authorization:  `Bearer ${REDIS_TOKEN()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Redis error: ${data.error}`);
    return data.result;
}

// ── Pipeline (batch GETs) ────────────────────────────────────────────────────
async function redisPipeline(commands) {
    const res = await fetch(`${REDIS_URL()}/pipeline`, {
        method:  'POST',
        headers: {
            Authorization:  `Bearer ${REDIS_TOKEN()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
    });
    return res.json(); // array of { result, error }
}

// ── Job CRUD ─────────────────────────────────────────────────────────────────

async function saveJob(job) {
    await redis('SET', `adsidol:job:${job.id}`, JSON.stringify(job));
    await redis('SADD', JOB_SET_KEY, job.id);
}

async function getJob(id) {
    const raw = await redis('GET', `adsidol:job:${id}`);
    return raw ? JSON.parse(raw) : null;
}

async function updateJob(job) {
    await redis('SET', `adsidol:job:${job.id}`, JSON.stringify(job));
}

async function deleteJob(id) {
    await redis('DEL', `adsidol:job:${id}`);
    await redis('SREM', JOB_SET_KEY, id);
}

async function getAllJobs() {
    const ids = await redis('SMEMBERS', JOB_SET_KEY);
    if (!ids || !ids.length) return [];

    // Batch fetch all jobs in one pipeline request
    const commands = ids.map(id => ['GET', `adsidol:job:${id}`]);
    const results  = await redisPipeline(commands);

    return results
        .map(r => r.result ? JSON.parse(r.result) : null)
        .filter(Boolean);
}

// ── Analytics (Permanent Ledger) ──────────────────────────────────────────────
async function logEvent(userId, event) {
    // We use a Redis List to store a linear history of all successful sends
    // Event: { type: 'initial'|'followup', date: Date.now(), email, vertical, name, step }
    const key = `adsidol:analytics:${userId}`;
    await redis('RPUSH', key, JSON.stringify(event));
}

async function getAnalytics(userId) {
    const key = `adsidol:analytics:${userId}`;
    const raw = await redis('LRANGE', key, 0, -1);
    if (!raw || !raw.length) return [];
    return raw.map(item => JSON.parse(item));
}

// ── Templates Store ───────────────────────────────────────────────────────────
async function getTemplates(userId) {
    const key = `adsidol:templates:${userId}`;
    const raw = await redis('GET', key);
    return raw ? JSON.parse(raw) : null;
}

async function setTemplates(userId, templatesPayload) {
    const key = `adsidol:templates:${userId}`;
    await redis('SET', key, JSON.stringify(templatesPayload));
}

module.exports = { saveJob, getJob, updateJob, deleteJob, getAllJobs, logEvent, getAnalytics, getTemplates, setTemplates };
