#!/usr/bin/env node
// פסקריפט לבדיקת זמינות דומיינים של Ktuvit

const fetch = require('node-fetch');

const KTUVIT_DOMAINS = [
  'https://www.ktuvit.me/',
  'https://ktuvit.me/',
  'https://www.ktuvit.co.il/',
  'https://ktuvit.co.il/',
  'https://www.ktuvit.online/',
  'https://ktuvit.online/',
];

async function testDomain(url) {
  try {
    console.log(`🔍 בודק ${url}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      timeout: 10000
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`✅ ${url} - זמין (${response.status})`);
      return true;
    } else {
      console.log(`⚠️  ${url} - קוד שגיאה ${response.status}`);
      return false;
    }
  } catch (error) {
    const errorType = error.code || error.name || 'Unknown';
    console.log(`❌ ${url} - ${errorType}: ${error.message}`);
    return false;
  }
}

async function findWorkingDomain() {
  console.log('🎯 מחפש דומיין עובד של Ktuvit...\n');
  
  for (const domain of KTUVIT_DOMAINS) {
    const isWorking = await testDomain(domain);
    if (isWorking) {
      console.log(`\n🎉 נמצא דומיין עובד: ${domain}`);
      console.log(`\nהוסף את השורה הבאה לקובץ .env שלך:`);
      console.log(`KTUVIT_BASE_URL=${domain}`);
      return domain;
    }
    // הפסקה קצרה בין בדיקות
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n😞 לא נמצא דומיין עובד של Ktuvit');
  console.log('יתכן שהשירות אינו זמין כרגע או שיש בעיית חיבור לאינטרנט.');
  return null;
}

// הרצת הבדיקה
findWorkingDomain().catch(console.error);