#!/usr/bin/env node
// הסקריפט עוזר להגדיר דומיין עובד של Ktuvit

const fs = require('fs');
const path = require('path');

console.log('🔧 הגדרת דומיין Ktuvit');
console.log('===================\n');

const envPath = path.join(__dirname, '.env');

// קריאת קובץ .env הנוכחי
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.log('❌ לא נמצא קובץ .env');
  process.exit(1);
}

// בדיקה אם יש הגדרה קיימת
const hasKtuvitUrl = envContent.includes('KTUVIT_BASE_URL=');
const currentUrl = hasKtuvitUrl ? 
  envContent.match(/KTUVIT_BASE_URL=(.+)/)?.[1]?.trim() : 
  'https://www.ktuvit.me/ (ברירת מחדל)';

console.log(`🌐 כתובת נוכחית: ${currentUrl}\n`);

console.log('📋 דומיינים אפשריים של Ktuvit:');
console.log('• https://www.ktuvit.me/');
console.log('• https://ktuvit.me/');
console.log('• https://www.ktuvit.co.il/');
console.log('• https://ktuvit.co.il/');
console.log('• https://www.ktuvit.online/');
console.log('• https://ktuvit.online/');

console.log('\n🔧 להגדרת דומיין חדש:');
console.log('1. הרץ: node update-domain.js <כתובת-דומיין>');
console.log('2. דוגמה: node update-domain.js https://www.ktuvit.co.il/');
console.log('3. הפעל מחדש את השרת: npm start');

console.log('\n🧪 לבדיקת דומיינים זמינים:');
console.log('   node test-domains.js');

console.log('\n💡 אם יש בעיות חיבור:');
console.log('• ודא שיש חיבור לאינטרנט');
console.log('• נסה דומיין אחר מהרשימה');
console.log('• בדוק שהאסימון (KTUVIT_TOKEN) נכון');

if (hasKtuvitUrl && currentUrl.includes('test-ktuvit.com')) {
  console.log('\n⚠️  זוהה דומיין בדיקה! זה עלול לגרום לכשלים בחיפוש.');
  console.log('   מומלץ להחליף לדומיין אמיתי של Ktuvit.');
}