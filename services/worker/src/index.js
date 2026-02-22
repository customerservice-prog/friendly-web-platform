import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const queueName = process.env.QUEUE_NAME || 'default';
const queue = new Queue(queueName, { connection });

// Minimal worker that proves the deployment plumbing works.
// Later: publish_build, verify_dns, provision_ssl, etc.
new Worker(
  queueName,
  async (job) => {
    return { ok: true, name: job.name, data: job.data, ts: Date.now() };
  },
  { connection }
);

// Self-test: enqueue a heartbeat job every 30s (non-destructive)
setInterval(async () => {
  await queue.add('heartbeat', { service: 'worker' }, { removeOnComplete: 50, removeOnFail: 50 });
}, 30000);

console.log(`[worker] started. redis=${redisUrl} queue=${queueName}`);
