# Milada Agiban — Final New Conference Deployment

هذه النسخة مجهزة للمؤتمر الجديد فقط.

## 1) Google Apps Script

استخدم الكود الموجود في:
`assets/js/google-apps-script-Code.gs.js`

يجب أن يكون المشروع مربوطًا بـGoogle Sheet الجديد، وأن تكون الأوراق:
- Attendees
- GroupPoints
- GameScores
- IndividualScores
- SiteConfig
- QuizAttemptsHistory

اضبط Script Property باسم `SECURITY_TOKEN`.

انشر Web App بنفس مشروع GAS الجديد، ثم استخدم رابط Web App الجديد.

## 2) Vercel Environment Variables

اضبط:
- `GAS_URL` = رابط Web App الجديد
- `GAS_TOKEN` = نفس قيمة `SECURITY_TOKEN` في GAS
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

لا تضع `GAS_TOKEN` داخل ملفات Frontend.

## 3) Vercel

بعد ضبط Environment Variables:
- Deploy جديد بدون Build Cache.
- اختبر قراءة Attendees.
- اختبر Quiz Submit.
- اختبر GameScores.

## 4) ملاحظة مهمة

`assets/js/config.js` يحتوي على رابط Web App الجديد فقط كـDirect URL للتوافق مع GitHub Pages.
على Vercel، الكتابة تمر عبر `/api/gas` وتستخدم `GAS_URL` و`GAS_TOKEN` من Environment Variables.

لا يوجد في هذه النسخة أي استيراد تلقائي لأسماء المشاركين من نسخة Google Sheet قديمة؛ المشاركون مصدرهم Google Sheets الجديد.
