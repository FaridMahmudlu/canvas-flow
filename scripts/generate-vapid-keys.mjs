import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== Generated VAPID Keys for CanvasFlow ===');
console.log('Add these to your .env.local file:');
console.log('');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log('VAPID_SUBJECT="mailto:student@canvas-flow.elte"');
console.log('');
