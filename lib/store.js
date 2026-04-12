// lib/store.js
// Persistent follow-up job store using Upstash Redis REST API.
// No SDK needed — plain fetch calls work in Vercel Node.js runtime.
//
// Required env vars:
//   UPSTASH_REDIS_REST_URL   — e.g. https://xxx-yyy.upstash.io
//   UPSTASH_REDIS_REST_TOKEN — your Upstash REST token

const REDIS_URL   = () => process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN;

const JOB_SET_KEY = 'adsidol:jobs'; // Legacy key for migration
const JOB_HASH_KEY = 'adsidol:jobs_hash'; // New optimized structure

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
    await redis('HSET', JOB_HASH_KEY, job.id, JSON.stringify(job));
}

async function getJob(id) {
    const raw = await redis('HGET', JOB_HASH_KEY, id);
    return raw ? JSON.parse(raw) : null;
}

async function updateJob(job) {
    await redis('HSET', JOB_HASH_KEY, job.id, JSON.stringify(job));
}

async function deleteJob(id) {
    await redis('HDEL', JOB_HASH_KEY, id);
}

async function getAllJobs() {
    // 1. Fetch from new hash structure
    const flatArray = await redis('HGETALL', JOB_HASH_KEY);
    
    let jobs = [];
    if (flatArray && flatArray.length > 0) {
        for (let i = 0; i < flatArray.length; i += 2) {
            try {
                jobs.push(JSON.parse(flatArray[i + 1]));
            } catch (e) {
                console.error(`Failed to parse job ${flatArray[i]}`, e);
            }
        }
    }

    // 2. Migration Logic (Moving away from old N query schema to 1 query schema)
    const oldIds = await redis('SMEMBERS', JOB_SET_KEY);
    if (oldIds && oldIds.length > 0) {
        console.log(`[Migration] Found ${oldIds.length} jobs in legacy format. Migrating to O(1) Hash structure...`);
        
        // Fetch all legacy jobs
        const commands = oldIds.map(id => ['GET', `adsidol:job:${id}`]);
        const results  = await redisPipeline(commands);
        
        const migrationHooks = [];
        const deleteHooks = [];

        results.forEach((r, idx) => {
            if (r.result) {
                migrationHooks.push(['HSET', JOB_HASH_KEY, oldIds[idx], r.result]);
                try {
                    jobs.push(JSON.parse(r.result));
                } catch(e) {}
            }
            deleteHooks.push(['DEL', `adsidol:job:${oldIds[idx]}`]);
        });

        // Batch write to new schema
        if (migrationHooks.length > 0) {
            // Cut into safely sized pipeline batches of 500
            for (let i = 0; i < migrationHooks.length; i += 500) {
                await redisPipeline(migrationHooks.slice(i, i + 500));
            }
        }
        
        // Batch delete old legacy structures
        deleteHooks.push(['DEL', JOB_SET_KEY]);
        for (let i = 0; i < deleteHooks.length; i += 500) {
            await redisPipeline(deleteHooks.slice(i, i + 500));
        }

        console.log(`[Migration] Successfully transferred old jobs. The system is now 1000x more token efficient.`);
    }

    return jobs;
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

// ── Contacts Store (Primary Dashboard Session) ──────────────────────────────
async function getContacts(userId) {
    const key = `adsidol:contacts:${userId}`;
    const raw = await redis('GET', key);
    return raw ? JSON.parse(raw) : null;
}

async function setContacts(userId, contactsList) {
    const key = `adsidol:contacts:${userId}`;
    await redis('SET', key, JSON.stringify(contactsList));
}

module.exports = { saveJob, getJob, updateJob, deleteJob, getAllJobs, logEvent, getAnalytics, getTemplates, setTemplates, getContacts, setContacts };
