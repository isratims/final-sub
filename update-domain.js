#!/usr/bin/env node
// פסקריפט לעדכון קובץ .env עם דומיין עובד

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

function updateEnvFile(newBaseUrl) {
  try {
    let envContent = '';
    
    // קרא קובץ .env קיים אם יש
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // הסר שורות KTUVIT_BASE_URL קיימות
    const lines = envContent.split('\n').filter(line => 
      !line.trim().startsWith('KTUVIT_BASE_URL=') && 
      !line.trim().startsWith('# KTUVIT_BASE_URL=')
    );
    
    // הוסף את הדומיין החדש
    lines.push(`KTUVIT_BASE_URL=${newBaseUrl}`);
    
    // כתוב חזרה לקובץ
    fs.writeFileSync(envPath, lines.join('\n') + '\n');
    console.log(`✅ עודכן קובץ .env עם הדומיין: ${newBaseUrl}`);
    console.log('אתחל את השרת (npm start) כדי שהשינויים ייכנסו לתוקף.');
    
  } catch (error) {
    console.error('❌ שגיאה בעדכון קובץ .env:', error.message);
  }
}

// אם הפסקריפט רץ עם ארגומנט דומיין
const newDomain = process.argv[2];
if (newDomain) {
  updateEnvFile(newDomain);
} else {
  console.log('שימוש: node update-domain.js <דומיין-חדש>');
  console.log('דוגמה: node update-domain.js https://ktuvit.co.il/');
}