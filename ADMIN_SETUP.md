# إعداد نظام الدرجات ولوحة الأدمن — ميلادا عجيبًا 2026

## Architecture الحالية

المسار الأساسي على Vercel هو:

`Browser → /api/* → Google Apps Script Web App → Google Sheet`

الموقع العادي يستخدم `/api/gas` للقراءة/حفظ محاولات المستخدم، بينما عمليات الأدمن تستخدم:

`Admin → /api/admin-auth → Session → /api/admin-data → GAS → Google Sheet`

يوجد `netlify/functions/` للتوافق مع النسخة القديمة، لكنه ليس المسار الأساسي عند النشر على Vercel.

## 1. Google Apps Script

ملف المصدر الموجود داخل المشروع:

`assets/js/google-apps-script-Code.gs.js`

انسخ **محتوى هذا الملف بالكامل** إلى `Code.gs` في مشروع Google Apps Script المرتبط بنفس Google Sheet.

### Script Property المطلوبة

من Apps Script:

**Project Settings → Script Properties**

أضف:

- `SECURITY_TOKEN` = قيمة سرية طويلة وعشوائية.

هذه القيمة يجب أن تطابق قيمة `GAS_TOKEN` في Vercel.

> لا تضع SECURITY_TOKEN داخل ملفات Frontend أو GitHub.

### Deployment

بعد لصق الكود:

**Deploy → Manage deployments → Edit → New version → Deploy**

يجب أن يكون Web App متاحًا للمستخدمين الذين سيستعملون الموقع.

بعد كل تعديل على `Code.gs` يجب نشر **نسخة جديدة** من الـDeployment. مجرد تعديل الملف داخل محرر Apps Script لا يغيّر النسخة المنشورة التي يستخدمها Vercel.

بعد النشر، تأكد أن `GAS_URL` في Vercel يشير إلى **نفس Deployment المنشور**.

## 2. Vercel Environment Variables

المتغيرات المطلوبة:

- `GAS_URL` = رابط Web App المنشور من Apps Script
- `GAS_TOKEN` = نفس قيمة `SECURITY_TOKEN` الموجودة في Script Properties
- `ADMIN_USERNAME` = اسم مستخدم الأدمن
- `ADMIN_PASSWORD` = كلمة مرور الأدمن
- `ADMIN_SESSION_SECRET` = مفتاح عشوائي طويل جدًا (32 بايت أو أكثر)

لا توجد قيم افتراضية آمنة لهذه المتغيرات في كود الإنتاج.

بعد تغيير Environment Variables، أعد Deploy على Vercel.

## 3. مهم جدًا بخصوص saveGameAttempt

وجود:

`saveGameAttempt`

و:

`handleSaveGameAttempt`

داخل ZIP لا يعني أن النسخة المنشورة من GAS تحتويهما.

النسخة المنشورة يجب أن تحتوي على:

- `doPost()`
- action = `saveGameAttempt`
- `handleSaveGameAttempt()`
- `GameScores`

إذا كان Vercel يشير إلى Deployment قديم، ستظهر رسالة:

`إجراء غير معروف: saveGameAttempt`

حتى لو كان الكود الصحيح موجودًا داخل GitHub.

## 4. أوراق Google Sheet

الكود لا يحذف الأوراق الحالية.

النظام الجديد يستخدم:

- `GameScores`
- `IndividualScores`
- `SiteConfig`
- `QuizAttemptsHistory` — تُنشأ عند الحاجة لحفظ تاريخ محاولات الكويز التي أعيد فتحها من الأدمن.

ويظل `Attendees` و`GroupPoints` موجودين للتوافق مع النظام القديم.

لا تُحذف أي ورقة يدويًا.

## 5. Quiz

الطالب لديه محاولة نشطة واحدة فقط لكل:

`الاسم + المجموعة + المحاضرة`

فتح الكويز بدون Submit لا ينشئ Attempt.

بعد Submit ناجح، يحفظ Backend الدرجة ويمنع أي محاولة ثانية.

إعادة الفتح متاحة للأدمن فقط.

عند Reset من الأدمن، يتم نقل المحاولة السابقة إلى:

`QuizAttemptsHistory`

ثم إزالة المحاولة النشطة فقط، وبالتالي لا تضيع الدرجة القديمة من السجل.

## 6. Admin

المصادقة الأساسية أصبحت Server-side:

`/api/admin-auth`

ثم Session موقعة بـ HMAC:

`/api/admin-verify`

ثم العمليات الحساسة:

`/api/admin-data`

ولا يعتمد السماح الحقيقي على إخفاء أزرار Frontend.

كذلك `/api/gas` لا يسمح بالـAdmin actions إلا مع Session أدمن صالحة.

## 7. GAS_TOKEN و SECURITY_TOKEN

هما نفس السر المقصود بين Vercel وGAS:

`Vercel GAS_TOKEN == Apps Script SECURITY_TOKEN`

لكن:

- `GAS_TOKEN` لا يوضع في Frontend.
- `SECURITY_TOKEN` لا يوضع في Frontend.
- Session الأدمن مختلفة عن GAS_TOKEN.
- `ADMIN_SESSION_SECRET` مختلفة عن GAS_TOKEN.

## 8. Direct GAS URL

`assets/js/config.js` يحتوي على `DIRECT_GAS_URL` للتوافق مع GitHub Pages/البيئة المباشرة.

إذا أنشأت Deployment جديدًا بعنوان مختلف، حدّث هذا الرابط أيضًا.

على Vercel، المسار الأساسي هو `/api/gas` ولا يحتاج الموقع إلى كشف GAS_TOKEN.

## 9. ملاحظات الاختبار

يمكن اختبار محليًا:

- JavaScript syntax.
- action names.
- وجود handlers.
- Admin session logic.
- Quiz once-only logic.
- Reset/history logic.
- API error propagation.

لا يمكن اختبار الكتابة الفعلية إلى Google Sheet من بيئة الاختبار المحلية هنا؛ لذلك يجب إجراء Smoke Test واحد بعد نشر GAS وVercel.

## 10. Smoke Test بعد النشر

1. افتح الموقع وسجل درجة لعبة.
2. تأكد أن الدرجة ظهرت في `GameScores`.
3. افتح Scorebook/الموقع وتأكد أن الدرجة ظهرت.
4. افتح Admin وتأكد أن الدرجة ظهرت.
5. عدّل الدرجة من Admin وتأكد أنها تغيرت في Sheet والموقع.
6. حل Quiz مرة واحدة وتأكد من وجود السجل في `IndividualScores`.
7. حاول الإرسال مرة ثانية وتأكد من `already_submitted`.
8. نفّذ Reset من Admin.
9. تأكد من انتقال المحاولة السابقة إلى `QuizAttemptsHistory`.
10. حل الكويز مرة ثانية وتأكد من إنشاء المحاولة الجديدة.
