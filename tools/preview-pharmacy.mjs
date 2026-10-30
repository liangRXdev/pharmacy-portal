import { startPharmacyServer } from './pharmacy-server.mjs';
const preview = await startPharmacyServer(Number(process.argv[2] || 4173));
console.log(`Pharmacy preview: ${preview.base}/pharmacy/`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await preview.close(); process.exit(0); });
