import cron from 'node-cron';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch'; // server.ts has fetch probably natively or we can just use the global fetch

// Actually we need to see how fetch is used in server.ts
