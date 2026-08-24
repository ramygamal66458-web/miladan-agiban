/**
 * ════════════════════════════════════════════════════════════════════════
 *  Google Apps Script (Code.gs) - قاعدة بيانات مؤتمر الشباب 2026
 *  النسخة المحسّنة بالكامل — تدعم التعديل الحي والتكامل المباشر
 * ════════════════════════════════════════════════════════════════════════
 *
 *  Sheet "Attendees" (9 أعمدة):
 *  [1]الاسم | [2]المجموعة | [3]الغرفة | [4]الأتوبيس | [5]المقعد | [6]النوع | [7]الرأي | [8]الرحلة | [9]آخر تعديل
 *  ملاحظة: النقاط تُدار في ورقة منفصلة GroupPoints — لا عمود لها هنا
 * ════════════════════════════════════════════════════════════════════════
 */

// ─── إعدادات ثابتة ───────────────────────────────────────────────────────────
const SPREADSHEET_ID  = '';  // اتركه فارغاً إذا فتحت السكربت من داخل الشيت مباشرة
const SECURITY_TOKEN  = PropertiesService.getScriptProperties().getProperty('SECURITY_TOKEN') || '';
const SHEET_NAME      = 'Attendees';

const HEADERS = [
  'الاسم',
  'المجموعة',
  'الغرفة',
  'الأتوبيس',
  'المقعد',
  'النوع',               // ذكر / أنثى
  'رأيك في المؤتمر',
  'ترشيح الرحلة الجاية',
  'آخر تعديل'           // ISO Timestamp
];


// ─── الحصول على الشيت أو إنشاؤه ─────────────────────────────────────────────
function getSheet() {
  let ss;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss && SPREADSHEET_ID) {
    try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (e) {}
  }
  if (!ss) {
    throw new Error(
      'لم يتم العثور على جدول البيانات. افتح السكربت من داخل Google Sheet.'
    );
  }
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    formatHeaderRow(sheet);
  }

  // ── إنشاء ورقة GroupPoints تلقائياً أيضاً لو لم تكن موجودة ──
  ensureGroupPointsSheet(ss);

  return sheet;
}

// ─── إنشاء ورقة نقاط المجموعات ────────────────────────────────────────────────
function ensureGroupPointsSheet(ss) {
  if (!ss) return null;
  let gpSheet = ss.getSheetByName('GroupPoints');
  if (!gpSheet) {
    const GP_HEADERS = [
      'المجموعة',
      'ي1_ورش', 'ي1_ألعاب', 'ي1_التزام', 'ي1_إجمالي',
      'ي2_ورش', 'ي2_ألعاب', 'ي2_التزام', 'ي2_إجمالي',
      'ي3_ورش', 'ي3_ألعاب', 'ي3_التزام', 'ي3_إجمالي',
      'حفلة_السمر',
      'الإجمالي_الكلي',
      'آخر تحديث'
    ];
    gpSheet = ss.insertSheet('GroupPoints');
    gpSheet.appendRow(GP_HEADERS);
    gpSheet.getRange(1, 1, 1, GP_HEADERS.length)
           .setFontWeight('bold')
           .setBackground('#1e3a5f')
           .setFontColor('#ffffff')
           .setHorizontalAlignment('center');
    gpSheet.setFrozenRows(1);
    gpSheet.setColumnWidths(1, GP_HEADERS.length, 120);
  }
  return gpSheet;
}

// ─── تنسيق صف العناوين ───────────────────────────────────────────────────────
function formatHeaderRow(sheet, headers = HEADERS) {
  const hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setValues([headers]);
  hRange.setFontWeight('bold')
        .setBackground('#06b6d4')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center')
        .setFontSize(11);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, HEADERS.length, 150);
}

// ─── بناء CORS Headers ───────────────────────────────────────────────────────
function corsOutput(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── doGet: جلب البيانات ─────────────────────────────────────────────────────
function doGet(e) {
  try {
    const sheet  = getSheet();
    const action = (e && e.parameter && e.parameter.action) || 'get';
    const rows   = sheet.getDataRange().getValues();

    // ── action=get: إرجاع كل المشتركين ──
    if (action === 'get' || action === 'getAll') {
      if (rows.length <= 1) {
        return corsOutput({ status: 'success', data: [] });
      }
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue; // تخطي الصفوف الفارغة
        items.push({
          rowIndex : i + 1,
          name     : String(r[0] || '').trim(),
          group    : String(r[1] || '').trim(),
          room     : String(r[2] || '').trim(),
          bus      : String(r[3] || '').trim(),
          seat     : String(r[4] || '').trim(),
          gender   : String(r[5] || '').trim(),
          feedback : String(r[6] || '').trim(),
          nextTrip : String(r[7] || '').trim(),
          lastEdit : String(r[8] || '').trim()
        });
      }
      return corsOutput({ status: 'success', data: items, count: items.length });
    }

    // ── action=getScores: نقاط المجموعات (نظام قديم — يبقى للتوافق) ──
    if (action === 'getScores') {
      const groupTotals = {};
      for (let i = 1; i < rows.length; i++) {
        const grp = String(rows[i][1] || '').trim();
        const pts = Number(rows[i][2] || 0);
        if (grp) {
          if (!groupTotals[grp]) groupTotals[grp] = { total: 0, count: 0 };
          groupTotals[grp].total += pts;
          groupTotals[grp].count++;
        }
      }
      const result = Object.entries(groupTotals).map(([name, v]) => ({
        name,
        points: v.total,
        average: v.count > 0 ? Math.round(v.total / v.count) : 0,
        members: v.count
      }));
      return corsOutput({ status: 'success', data: result });
    }

    // ── action=getGroupScores: نقاط المجموعات المفصّلة من GroupPoints ──
    if (action === 'getGroupScores') {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const gSheet = ss.getSheetByName('GroupPoints');
        if (!gSheet) return corsOutput({ status: 'success', data: [] });
        const gData = gSheet.getDataRange().getValues();
        if (gData.length < 2) return corsOutput({ status: 'success', data: [] });
        // الأعمدة: المجموعة|ي1_ورش|ي1_ألعاب|ي1_التزام|ي1_إجمالي|ي2_ورش|ي2_ألعاب|ي2_التزام|ي2_إجمالي|ي3_ورش|ي3_ألعاب|ي3_التزام|ي3_إجمالي|حفلة_السمر|الإجمالي_الكلي|آخر تحديث
        const result = [];
        for (let i = 1; i < gData.length; i++) {
          const r = gData[i];
          const group = String(r[0] || '').trim();
          if (!group) continue;
          result.push({
            group,
            day1: { workshop: Number(r[1]||0), games: Number(r[2]||0), commitment: Number(r[3]||0), total: Number(r[4]||0) },
            day2: { workshop: Number(r[5]||0), games: Number(r[6]||0), commitment: Number(r[7]||0), total: Number(r[8]||0) },
            day3: { workshop: Number(r[9]||0), games: Number(r[10]||0), commitment: Number(r[11]||0), total: Number(r[12]||0) },
            party: Number(r[13]||0),
            grandTotal: Number(r[14]||0)
          });
        }
        return corsOutput({ status: 'success', data: result });
      } catch(e) {
        return corsOutput({ status: 'error', message: e.toString() });
      }
    }

    // ── نظام الدرجات الجديد: قراءة سجل الدرجات والإعدادات ──
    if (action === 'getScorebook') {
      return handleGetScorebook();
    }
    if (action === 'getSiteConfig') {
      return handleGetSiteConfig();
    }

    return corsOutput({ status: 'error', message: 'إجراء غير معروف: ' + action });
  } catch (err) {
    return corsOutput({ status: 'error', message: err.toString() });
  }
}

// ─── doPost: تعديل البيانات ──────────────────────────────────────────────────
function doPost(e) {
  try {
    const sheet = getSheet();
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    const action = String(body.action || 'get').trim();

    // ── القراءة فقط لا تحتاج توكن ──
    if (action === 'get' || action === 'getAll') {
      return doGet(e);
    }
    if (action === 'getGroupScores') {
      return doGet({ parameter: { action: 'getGroupScores' } });
    }
    if (action === 'getScorebook') {
      return handleGetScorebook();
    }
    if (action === 'getSiteConfig') {
      return handleGetSiteConfig();
    }

    // كل عمليات الكتابة، بما فيها saveGameAttempt/saveIndividualScore،
    // يجب أن تمر من Proxy موثوق يضيف GAS_TOKEN.
    if (!SECURITY_TOKEN) {
      return corsOutput({status:'error',message:'SECURITY_TOKEN غير مضبوط في Google Apps Script.'});
    }
    if (body.token !== SECURITY_TOKEN) {
      return corsOutput({
        status:'error',
        message:'مفتاح الأمان غير صحيح ❌ تأكد من مطابقة GAS_TOKEN مع SECURITY_TOKEN.'
      });
    }

    // ── عمليات تسجيل الدرجات من المستخدم/الأدمن ──
    if (action === 'saveGameAttempt') {
      return handleSaveGameAttempt(sheet, body);
    }
    if (action === 'saveIndividualScore') {
      if (/^(attendance\d+|pamphlet)$/.test(String(body.category || '')) && body.adminAuthorized !== true) {
        return corsOutput({status:'error',message:'تعديل الحضور/البانفلت متاح للأدمن فقط.'});
      }
      return handleSaveIndividualScore(sheet, body);
    }

    // ── عمليات الأدمن الخاصة بنظام الدرجات والإعدادات ──
    if (action === 'adminSetScore') {
      return handleAdminSetScore(sheet, body);
    }
    if (action === 'adminResetQuiz') {
      return handleAdminResetQuiz(sheet, body);
    }
    if (action === 'updateSiteConfig') {
      return handleUpdateSiteConfig(sheet, body);
    }

    // ── ping: اختبار الاتصال ──
    if (action === 'ping') {
      return corsOutput({ status: 'success', message: 'pong ✅', timestamp: new Date().toISOString() });
    }

    // ── add / update: إضافة أو تحديث مشترك ──
    if (action === 'add' || action === 'update') {
      return handleAddOrUpdate(sheet, body);
    }

    // ── bulkImport: رفع كامل ──
    if (action === 'bulkImport') {
      return handleBulkImport(sheet, body);
    }

    // ── updateGroupPoints: تحديث نقاط مجموعة (إجمالي فقط) ──
    if (action === 'updateGroupPoints') {
      return handleUpdateGroupPoints(sheet, body);
    }

    // ── updateGroupDayScore: نقاط يوم مفصّلة (ورش + ألعاب + التزام) ──
    if (action === 'updateGroupDayScore') {
      return handleUpdateGroupDayScore(sheet, body);
    }

    // ── updatePartyScore: نقاط حفلة السمر ──
    if (action === 'updatePartyScore') {
      return handleUpdatePartyScore(sheet, body);
    }

    // ── addFeedback: تسجيل رأي مشترك ──
    if (action === 'addFeedback') {
      return handleAddFeedback(sheet, body);
    }

    // ── delete: حذف مشترك ──
    if (action === 'delete') {
      return handleDelete(sheet, body);
    }

    // ── assignSeat: تعيين مقعد أتوبيس ──
    if (action === 'assignSeat') {
      return handleAssignSeat(sheet, body);
    }

    // ── unassignSeat: إزالة من الأتوبيس ──
    if (action === 'unassignSeat') {
      return handleUnassignSeat(sheet, body);
    }

    // ── assignRoom: تعيين غرفة ──
    if (action === 'assignRoom') {
      return handleAssignRoom(sheet, body);
    }

    // ── unassignRoom: إزالة من الغرفة ──
    if (action === 'unassignRoom') {
      return handleUnassignRoom(sheet, body);
    }

    // ── updateField: تحديث حقل واحد ──
    if (action === 'updateField') {
      return handleUpdateField(sheet, body);
    }

    return corsOutput({ status: 'error', message: 'إجراء غير معروف: ' + action });
  } catch (err) {
    return corsOutput({ status: 'error', message: err.toString() });
  }
}

// يبحث عن صف شخص بالاسم فقط، ويرفض التعديل إذا كان الاسم مكررًا.
// لا نغيّر الـData Model الحالي لأن Attendees لا يحتوي على ID ثابت.
function findUniquePersonRow(sheet, name) {
  const key=String(name||'').trim().toLowerCase();
  const rows=sheet.getDataRange().getValues();
  const matches=[];
  for(let i=1;i<rows.length;i++) {
    if(String(rows[i][0]||'').trim().toLowerCase()===key) matches.push(i+1);
  }
  if(matches.length===1) return {row:matches[0],duplicate:false};
  if(matches.length>1) return {row:-1,duplicate:true,count:matches.length};
  return {row:-1,duplicate:false,count:0};
}

function handleAddOrUpdate(sheet, body) {
  const name     = String(body.name || '').trim();
  const group    = String(body.group    !== undefined ? body.group    : '').trim();
  const room     = String(body.room     !== undefined ? body.room     : '').trim();
  const bus      = String(body.bus      !== undefined ? body.bus      : '').trim();
  const seat     = String(body.seat     !== undefined ? body.seat     : '').trim();
  const gender   = String(body.gender   !== undefined ? body.gender   : '').trim();
  const feedback = String(body.feedback !== undefined ? body.feedback : '').trim();
  const nextTrip = String(body.nextTrip !== undefined ? body.nextTrip : '').trim();
  const preserveEmpty = !!body.preserveEmpty; // حماية الحقول الفارغة

  if (!name) {
    return corsOutput({ status: 'error', message: 'اسم المشترك مطلوب' });
  }

  const match=findUniquePersonRow(sheet,name);
  if(match.duplicate) {
    return corsOutput({status:'error',message:`الاسم "${name}" مكرر في ${match.count} صفوف؛ لا يمكن تعديل شخص بالاسم فقط بأمان.`});
  }
  const foundRow=match.row;
  const rows = sheet.getDataRange().getValues();
  const now = new Date().toISOString();

  if (foundRow > 0 && preserveEmpty) {
    // ── وضع الحماية: لا تمسح الخلايا الموجودة بقيم فارغة ──
    const existing = rows[foundRow - 1]; // 0-indexed
    const merged = [
      name,                                          // [1] الاسم دائماً
      group    || String(existing[1] || ''),          // [2] المجموعة
      room     || String(existing[2] || ''),          // [3] الغرفة
      bus      || String(existing[3] || ''),          // [4] الأتوبيس
      seat     || String(existing[4] || ''),          // [5] المقعد
      gender   || String(existing[5] || ''),          // [6] النوع
      feedback || String(existing[6] || ''),          // [7] الرأي
      nextTrip || String(existing[7] || ''),          // [8] الرحلة
      now                                             // [9] آخر تعديل
    ];
    sheet.getRange(foundRow, 1, 1, 9).setValues([merged]);
    return corsOutput({
      status : 'success',
      message: `تم تحديث بيانات المشترك "${name}" بنجاح (مع حماية الحقول الفارغة) ✅`,
      row    : foundRow
    });
  }

  const rowData = [name, group, room, bus, seat, gender, feedback, nextTrip, now];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, 9).setValues([rowData]);
    return corsOutput({
      status : 'success',
      message: `تم تحديث بيانات المشترك "${name}" بنجاح ✅`,
      row    : foundRow
    });
  } else {
    sheet.appendRow(rowData);
    return corsOutput({
      status : 'success',
      message: `تم إضافة المشترك "${name}" بنجاح ✅`,
      row    : sheet.getLastRow()
    });
  }
}

function handleBulkImport(sheet, body) {
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return corsOutput({ status: 'error', message: 'لا توجد بيانات للرفع' });
  }

  const rows    = sheet.getDataRange().getValues();
  const nameMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const n = String(rows[i][0] || '').trim().toLowerCase();
    if (n) nameMap.set(n, i + 1);
  }

  const now = new Date().toISOString();
  let updatedCount = 0;
  let addedCount   = 0;

  items.forEach(item => {
    const name = String(item.name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();

    const rowData = [
      name,
      String(item.group || '').trim(),
      String(item.room || '').trim(),
      String(item.bus || '').trim(),
      String(item.seat || '').trim(),
      String(item.gender || '').trim(),
      String(item.feedback || '').trim(),
      String(item.nextTrip || '').trim(),
      now
    ];

    if (nameMap.has(key)) {
      const rowIndex = nameMap.get(key);
      sheet.getRange(rowIndex, 1, 1, 9).setValues([rowData]);
      updatedCount++;
    } else {
      sheet.appendRow(rowData);
      nameMap.set(key, sheet.getLastRow());
      addedCount++;
    }
  });

  return corsOutput({
    status : 'success',
    message: `تم استيراد ${items.length} مشترك (${addedCount} جديد، ${updatedCount} تحديث) ✅`,
    count  : items.length
  });
}

function handleUpdateGroupPoints(sheet, body) {
  const groupName = String(body.group || '').trim();
  const points    = Number(body.points || 0);
  if (!groupName) return corsOutput({ status: 'error', message: 'اسم المجموعة مطلوب' });

  const ss = sheet.getParent();
  let gpSheet = ss.getSheetByName('GroupPoints');
  if (!gpSheet) {
    gpSheet = ss.insertSheet('GroupPoints');
    gpSheet.appendRow(['المجموعة', 'النقاط', 'آخر تحديث']);
    gpSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#06b6d4').setFontColor('#ffffff');
  }

  const gpData = gpSheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < gpData.length; i++) {
    if (String(gpData[i][0]).trim().toLowerCase() === groupName.toLowerCase()) {
      foundRow = i + 1;
      break;
    }
  }

  const now = new Date().toISOString();
  if (foundRow > 0) {
    gpSheet.getRange(foundRow, 2).setValue(points);
    gpSheet.getRange(foundRow, 3).setValue(now);
  } else {
    gpSheet.appendRow([groupName, points, now]);
  }

  return corsOutput({
    status : 'success',
    message: `✅ تم تحديث نقاط مجموعة "${groupName}" → ${points} نقطة`,
    group  : groupName,
    points : points
  });
}

function handleUpdateGroupDayScore(sheet, body) {
  /*
   * payload المُرسل:
   * { action:'updateGroupDayScore', group:'النسور', day:'1',
   *   category:'workshop'|'games'|'commitment',
   *   points:32, dayTotal:85, grandTotal:180 }
   *
   * هيكل ورقة GroupPoints:
   *   المجموعة | ي1_ورش | ي1_ألعاب | ي1_التزام | ي1_إجمالي |
   *             ي2_ورش | ي2_ألعاب | ي2_التزام | ي2_إجمالي |
   *             ي3_ورش | ي3_ألعاب | ي3_التزام | ي3_إجمالي | حفلة_السمر | الإجمالي_الكلي
   */
  const groupName  = String(body.group    || '').trim();
  const day        = String(body.day      || '1').trim();    // '1', '2', '3'
  const category   = String(body.category || '').trim();    // 'workshop', 'games', 'commitment'
  const points     = Number(body.points     || 0);
  const dayTotal   = Number(body.dayTotal   || 0);
  const grandTotal = Number(body.grandTotal || 0);

  if (!groupName) return corsOutput({ status: 'error', message: 'اسم المجموعة مطلوب' });

  // ─ عمود الهيكل (13 عمود + 1 حفلة سمر + 1 إجمالي كلي + 1 آخر تحديث = 16 عمود) ─
  const GP_HEADERS = [
    'المجموعة',
    'ي1_ورش', 'ي1_ألعاب', 'ي1_التزام', 'ي1_إجمالي',
    'ي2_ورش', 'ي2_ألعاب', 'ي2_التزام', 'ي2_إجمالي',
    'ي3_ورش', 'ي3_ألعاب', 'ي3_التزام', 'ي3_إجمالي',
    'حفلة_السمر',
    'الإجمالي_الكلي',
    'آخر تحديث'
  ];

  const ss = sheet.getParent();
  const gpSheet = ensureGroupPointsSheet(ss);

  // ─ تحديد خريطة العمود ─
  // لكل يوم 4 أعمدة: offset = (day-1)*4 + 1
  const catMap = { workshop: 0, games: 1, commitment: 2 };
  const dayOffset = (Number(day) - 1) * 4 + 1;  // العمود الأول لكل يوم
  const catOffset = catMap[category] !== undefined ? catMap[category] : 0;
  const pointsCol  = dayOffset + catOffset + 1;  // عمود النقاط (1-indexed)
  const totalCol   = dayOffset + 3 + 1;           // عمود الإجمالي اليومي
  const grandCol   = 15;                           // عمود الإجمالي الكلي (15th)
  const editCol    = 16;                           // عمود آخر تحديث (16th)

  const gpData = gpSheet.getDataRange().getValues();
  let rowIdx   = -1;
  for (let i = 1; i < gpData.length; i++) {
    if (String(gpData[i][0]).trim().toLowerCase() === groupName.toLowerCase()) {
      rowIdx = i + 1; // 1-indexed sheet row
      break;
    }
  }

  const now = new Date().toISOString();
  if (rowIdx < 0) {
    // إنشاء صف جديد
    const newRow = new Array(GP_HEADERS.length).fill('');
    newRow[0]           = groupName;
    newRow[pointsCol-1] = points;
    newRow[totalCol-1]  = dayTotal;
    newRow[grandCol-1]  = grandTotal;
    newRow[editCol-1]   = now;
    gpSheet.appendRow(newRow);
  } else {
    gpSheet.getRange(rowIdx, pointsCol).setValue(points);
    gpSheet.getRange(rowIdx, totalCol).setValue(dayTotal);
    gpSheet.getRange(rowIdx, grandCol).setValue(grandTotal);
    gpSheet.getRange(rowIdx, editCol).setValue(now);
  }

  return corsOutput({
    status    : 'success',
    message   : `✅ تم تحديث نقاط ${category} لمجموعة "${groupName}" اليوم ${day}: ${points} نقطة`,
    group     : groupName,
    day       : day,
    category  : category,
    points    : points,
    dayTotal  : dayTotal,
    grandTotal: grandTotal
  });
}

function handleUpdatePartyScore(sheet, body) {
  const groupName  = String(body.group      || '').trim();
  const points     = Number(body.points     || 0);
  const grandTotal = Number(body.grandTotal || 0);

  if (!groupName) return corsOutput({ status: 'error', message: 'اسم المجموعة مطلوب' });

  const GP_HEADERS = [
    'المجموعة',
    'ي1_ورش', 'ي1_ألعاب', 'ي1_التزام', 'ي1_إجمالي',
    'ي2_ورش', 'ي2_ألعاب', 'ي2_التزام', 'ي2_إجمالي',
    'ي3_ورش', 'ي3_ألعاب', 'ي3_التزام', 'ي3_إجمالي',
    'حفلة_السمر',
    'الإجمالي_الكلي',
    'آخر تحديث'
  ];

  const ss = sheet.getParent();
  const gpSheet = ensureGroupPointsSheet(ss);

  const partyCol = 14; // عمود حفلة_السمر (1-indexed)
  const grandCol = 15; // عمود الإجمالي الكلي (1-indexed)
  const editCol  = 16; // عمود آخر تحديث (1-indexed)

  const gpData = gpSheet.getDataRange().getValues();
  let rowIdx   = -1;
  for (let i = 1; i < gpData.length; i++) {
    if (String(gpData[i][0]).trim().toLowerCase() === groupName.toLowerCase()) {
      rowIdx = i + 1;
      break;
    }
  }

  const now = new Date().toISOString();
  if (rowIdx < 0) {
    const newRow = new Array(GP_HEADERS.length).fill('');
    newRow[0]          = groupName;
    newRow[partyCol-1] = points;
    newRow[grandCol-1] = grandTotal;
    newRow[editCol-1]  = now;
    gpSheet.appendRow(newRow);
  } else {
    gpSheet.getRange(rowIdx, partyCol).setValue(points);
    gpSheet.getRange(rowIdx, grandCol).setValue(grandTotal);
    gpSheet.getRange(rowIdx, editCol).setValue(now);
  }

  return corsOutput({
    status    : 'success',
    message   : `✅ تم تحديث نقاط حفلة السمر لمجموعة "${groupName}": ${points} نقطة`,
    group     : groupName,
    points    : points,
    grandTotal: grandTotal
  });
}



// ─── تسجيل رأي مشترك ─────────────────────────────────────────────────────────
function handleAddFeedback(sheet, body) {
  const name     = String(body.name     || 'زائر').trim();
  const feedback = String(body.feedback || '').trim();
  const nextTrip = String(body.nextTrip || '').trim();

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      if (feedback) sheet.getRange(i + 1, 7).setValue(feedback); // عمود الرأي هو 7
      if (nextTrip) sheet.getRange(i + 1, 8).setValue(nextTrip); // عمود الرحلة هو 8
      sheet.getRange(i + 1, 9).setValue(new Date().toISOString()); // عمود آخر تعديل هو 9
      return corsOutput({ status: 'success', message: 'تم تسجيل الرأي بنجاح ✅' });
    }
  }
  
  sheet.appendRow([name, '', '', '', '', '', feedback, nextTrip, new Date().toISOString()]);
  return corsOutput({ status: 'success', message: 'تم إضافة الرأي بنجاح ✅' });
}

// ─── حذف مشترك ───────────────────────────────────────────────────────────────
function handleDelete(sheet, body) {
  const name = String(body.name || '').trim();
  if (!name) return corsOutput({ status: 'error', message: 'الاسم مطلوب' });

  const match=findUniquePersonRow(sheet,name);
  if(match.duplicate) return corsOutput({status:'error',message:`الاسم "${name}" مكرر؛ لا يمكن الحذف بالاسم فقط بأمان.`});
  if(match.row>0) {
    sheet.deleteRow(match.row);
    return corsOutput({status:'success',message:'تم الحذف بنجاح ✅',name});
  }
  return corsOutput({status:'error',message:'المشترك غير موجود: '+name});
}

// ─── تعيين مقعد أتوبيس ────────────────────────────────────────────────────────
function handleAssignSeat(sheet, body) {
  const name = String(body.name || '').trim();
  const bus  = String(body.bus  || '').trim();
  const seat = String(body.seat || '').trim();
  if (!name) return corsOutput({ status: 'error', message: 'الاسم مطلوب' });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 4).setValue(bus);  // الأتوبيس هو 4
      sheet.getRange(rowNum, 5).setValue(seat); // المقعد هو 5
      sheet.getRange(rowNum, 9).setValue(new Date().toISOString()); // آخر تعديل هو 9
      return corsOutput({ status: 'success', message: `تم تعيين ${name} في ${bus} مقعد ${seat}` });
    }
  }
  return corsOutput({ status: 'error', message: `لم يُعثر على المشترك: ${name}` });
}

// ─── تعيين غرفة ─────────────────────────────────────────────────────────────
function handleAssignRoom(sheet, body) {
  const name = String(body.name || '').trim();
  const room = String(body.room || '').trim();
  if (!name) return corsOutput({ status: 'error', message: 'الاسم مطلوب' });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 3).setValue(room); // الغرفة هي 3
      sheet.getRange(rowNum, 9).setValue(new Date().toISOString()); // آخر تعديل هو 9
      return corsOutput({ status: 'success', message: `تم تسكين ${name} في غرفة ${room}` });
    }
  }
  return corsOutput({ status: 'error', message: `لم يُعثر على المشترك: ${name}` });
}

// ─── إزالة من الأتوبيس ────────────────────────────────────────────────────────
function handleUnassignSeat(sheet, body) {
  const name = String(body.name || '').trim();
  if (!name) return corsOutput({ status: 'error', message: 'الاسم مطلوب' });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 4).setValue('');
      sheet.getRange(rowNum, 5).setValue('');
      sheet.getRange(rowNum, 9).setValue(new Date().toISOString());
      return corsOutput({ status: 'success', message: `تم إلغاء ركوب الأتوبيس لـ ${name}` });
    }
  }
  return corsOutput({ status: 'error', message: `لم يُعثر على المشترك: ${name}` });
}

// ─── إزالة من الغرفة ─────────────────────────────────────────────────────────
function handleUnassignRoom(sheet, body) {
  const name = String(body.name || '').trim();
  if (!name) return corsOutput({ status: 'error', message: 'الاسم مطلوب' });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 3).setValue('');
      sheet.getRange(rowNum, 9).setValue(new Date().toISOString());
      return corsOutput({ status: 'success', message: `تم إلغاء تسكين ${name}` });
    }
  }
  return corsOutput({ status: 'error', message: `لم يُعثر على المشترك: ${name}` });
}

// ─── تحديث حقل واحد ─────────────────────────────────────────────────────────
function handleUpdateField(sheet, body) {
  const name  = String(body.name || '').trim();
  const field = String(body.field || '').trim();
  const val   = body.value;
  if (!name || !field) return corsOutput({ status: 'error', message: 'الاسم والحقل مطلوبان' });

  const fieldCols = {
    name: 1, group: 2, room: 3,
    bus: 4, seat: 5, gender: 6, feedback: 7, nextTrip: 8
  };

  const colIdx = fieldCols[field];
  if (!colIdx) return corsOutput({ status: 'error', message: 'الحقل غير معروف: ' + field });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      const rowNum = i + 1;
      let finalVal = val;
      sheet.getRange(rowNum, colIdx).setValue(finalVal);
      sheet.getRange(rowNum, 9).setValue(new Date().toISOString());
      return corsOutput({ status: 'success', message: `تم تحديث الحقل ${field} للمشترك ${name}` });
    }
  }
  return corsOutput({ status: 'error', message: `لم يُعثر على المشترك: ${name}` });
}

// ─── ترقية الهيكل الحالي (Migration) ──────────────────────────────────────────
function handleMigrateSchema(sheet) {
  const rows = sheet.getDataRange().getValues();
  const currentHeaders = rows[0] || [];

  if (currentHeaders.length >= 10) {
    return corsOutput({ status: 'success', message: 'الجدول مجهز بالفعل للهيكل الجديد ✅' });
  }

  // نحفظ البيانات القديمة مؤقتاً
  const oldItems = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    oldItems.push({
      name: String(r[0] || '').trim(),
      group: String(r[1] || '').trim(),
      points: Number(r[2] || 0),
      room: String(r[3] || '').trim(),
      bus: String(r[4] || '').trim(),
      seat: String(r[5] || '').trim(),
      gender: '', // جديد
      feedback: String(r[6] || '').trim(),
      nextTrip: String(r[7] || '').trim()
    });
  }

  // مسح الشيت وإعادة تهيئته بالعناوين العشرة الجديدة
  sheet.clearContents();
  formatHeaderRow(sheet);

  if (oldItems.length > 0) {
    // 9 أعمدة فقط بدون النقاط — النقاط تُدار في ورقة GroupPoints
    const newRows = oldItems.map(item => [
      item.name,
      item.group,
      item.room,
      item.bus,
      item.seat,
      item.gender,
      item.feedback,
      item.nextTrip,
      new Date().toISOString()
    ]);
    sheet.getRange(2, 1, newRows.length, HEADERS.length).setValues(newRows);
  }

  return corsOutput({ status: 'success', message: `تم ترقية الهيكل بنجاح وإعادة بناء ${oldItems.length} مشترك.` });
}

// ─── إنشاء شيت الملاحظات ─────────────────────────────────────────────────────
function getOrCreateNotesSheet(ss) {
  let ns = ss.getSheetByName('_Meta');
  if (!ns) {
    ns = ss.insertSheet('_Meta');
    ns.hideSheet();
  }
  return ns;
}


/* ═══════════════════════════════════════════════════════════════════════
   نظام الدرجات الجديد — الحد الأقصى 300 نقطة
   الألعاب 100 + المحاضرتان 30 + الحضور والالتزام 120 + البانفلت 50
   ═══════════════════════════════════════════════════════════════════════ */
function ensureNewScoreSheets(ss) {
  const gameHeaders = ['المجموعة','gameId','score','max','submittedAt'];
  const individualHeaders = ['الاسم','المجموعة','category','score','max','submittedAt'];
  const configHeaders = ['key','value','updatedAt'];
  const quizHistoryHeaders = ['الاسم','المجموعة','category','score','max','submittedAt','resetAt'];
  let gs = ss.getSheetByName('GameScores');
  if (!gs) { gs = ss.insertSheet('GameScores'); gs.appendRow(gameHeaders); formatHeaderRow(gs, gameHeaders); }
  let is = ss.getSheetByName('IndividualScores');
  if (!is) { is = ss.insertSheet('IndividualScores'); is.appendRow(individualHeaders); formatHeaderRow(is, individualHeaders); }
  let cs = ss.getSheetByName('SiteConfig');
  if (!cs) { cs = ss.insertSheet('SiteConfig'); cs.appendRow(configHeaders); formatHeaderRow(cs, configHeaders); }
  let qh = ss.getSheetByName('QuizAttemptsHistory');
  if (!qh) { qh = ss.insertSheet('QuizAttemptsHistory'); qh.appendRow(quizHistoryHeaders); formatHeaderRow(qh, quizHistoryHeaders); }
  return {gs,is,cs,qh};
}

function handleGetScorebook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureNewScoreSheets(ss);
  const gameRows = sheets.gs.getDataRange().getValues();
  const indRows = sheets.is.getDataRange().getValues();
  const configRows = sheets.cs.getDataRange().getValues();
  const gameScores=[];
  const individualScores=[];
  const config={};
  for(let i=1;i<gameRows.length;i++) {
    const r=gameRows[i]; if(!r[0] || !r[1]) continue;
    gameScores.push({group:String(r[0]).trim(),gameId:String(r[1]).trim(),score:Number(r[2]||0),max:Number(r[3]||0),submittedAt:String(r[4]||'')});
  }
  for(let i=1;i<indRows.length;i++) {
    const r=indRows[i]; if(!r[0] || !r[2]) continue;
    individualScores.push({name:String(r[0]).trim(),group:String(r[1]).trim(),category:String(r[2]).trim(),score:Number(r[3]||0),max:Number(r[4]||0),submittedAt:String(r[5]||'')});
  }
  for(let i=1;i<configRows.length;i++) {
    const k=String(configRows[i][0]||'').trim(); if(!k) continue;
    let v=configRows[i][1];
    try { v=JSON.parse(String(v)); } catch(e) {}
    config[k]=v;
  }
  if (config.pamphletMax == null) config.pamphletMax=50;
  return corsOutput({status:'success',data:{gameScores,individualScores,config}});
}

function handleGetSiteConfig() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const {cs}=ensureNewScoreSheets(ss);
  const rows=cs.getDataRange().getValues(); const config={};
  for(let i=1;i<rows.length;i++) { const k=String(rows[i][0]||'').trim(); if(!k) continue; try{config[k]=JSON.parse(String(rows[i][1]));}catch(e){config[k]=rows[i][1];} }
  if(config.pamphletMax==null) config.pamphletMax=50;
  return corsOutput({status:'success',data:config});
}

function findRowByPair(sheet, colA, valA, colB, valB) {
  const rows=sheet.getDataRange().getValues();
  for(let i=1;i<rows.length;i++) {
    if(String(rows[i][colA-1]||'').trim().toLowerCase()===String(valA||'').trim().toLowerCase() &&
       String(rows[i][colB-1]||'').trim().toLowerCase()===String(valB||'').trim().toLowerCase()) return i+1;
  }
  return -1;
}

function handleSaveGameAttempt(sheet, body) {
  const group=String(body.group||'').trim(), gameId=String(body.gameId||'').trim();
  const maxMap={hymn:15,pressure:15,sketch:30,studio:20,conferenceHymn:20};
  if(!group || !gameId || maxMap[gameId]==null) return corsOutput({status:'error',message:'بيانات اللعبة غير مكتملة'});
  const max=maxMap[gameId];
  const rawScore=Number(body.score);
  const score=Math.max(0,Math.min(max,Number.isFinite(rawScore)?rawScore:0));
  const lock=LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ss=sheet.getParent(); const {gs}=ensureNewScoreSheets(ss);
    const row=findRowByPair(gs,1,group,2,gameId);
    if(row>0) return corsOutput({status:'already_submitted',message:'المجموعة لعبت الفقرة دي بالفعل، وممنوع تتكرر.',score:Number(gs.getRange(row,3).getValue()||0),max});
    gs.appendRow([group,gameId,score,max,new Date().toISOString()]);
    return corsOutput({status:'success',message:'تم تسجيل نتيجة اللعبة للمجموعة مرة واحدة.',score,max});
  } finally {
    lock.releaseLock();
  }
}

function handleSaveIndividualScore(sheet, body) {
  const name=String(body.name||'').trim(), group=String(body.group||'').trim(), category=String(body.category||'').trim();
  const allowed={lecture1:15,lecture2:15,attendance1:15,attendance2:15,attendance3:15,attendance4:15,attendance5:15,attendance6:15,attendance7:15,attendance8:15,pamphlet:50};
  if(!name || !group || allowed[category]==null) return corsOutput({status:'error',message:'بيانات الدرجة الفردية غير مكتملة'});
  const declaredMax = Number(body.max);
  const max = category==='pamphlet' ? 50 : Math.min(
    allowed[category],
    Number.isFinite(declaredMax) && declaredMax > 0 ? declaredMax : allowed[category]
  );
  const rawScore = Number(body.score);
  const score=Math.max(0,Math.min(max,Number.isFinite(rawScore) ? rawScore : 0));
  const lock=LockService.getScriptLock();
  lock.waitLock(5000);
  try {
  const ss=sheet.getParent(); const {is}=ensureNewScoreSheets(ss);
  const rows=is.getDataRange().getValues();
  for(let i=1;i<rows.length;i++) {
    if(String(rows[i][0]||'').trim().toLowerCase()===name.toLowerCase() &&
       String(rows[i][1]||'').trim().toLowerCase()===group.toLowerCase() &&
       String(rows[i][2]||'').trim()===category) {
      // المحاضرات: محاولة واحدة فقط من الطالب. التعديل/إعادة الفتح للأدمن فقط.
      if(category==='lecture1' || category==='lecture2') {
        return corsOutput({status:'already_submitted',message:'الكويز تم حله وتسجيل درجته بالفعل. إعادة الفتح متاحة من لوحة الأدمن فقط.',score:Number(rows[i][3]||0),max:Number(rows[i][4]||max)});
      }
      // الحضور/البانفلت يظل قابلاً للتعديل من صفحات التسجيل المخصصة.
      is.getRange(i+1,1,1,6).setValues([[name,group,category,score,max,new Date().toISOString()]]);
      return corsOutput({status:'success',message:'تم حفظ/تعديل الدرجة الفردية.',score,max});
    }
  }
  is.appendRow([name,group,category,score,max,new Date().toISOString()]);
  return corsOutput({status:'success',message:'تم تسجيل الدرجة الفردية.',score,max});
  } finally {
    lock.releaseLock();
  }
}

function handleAdminResetQuiz(sheet, body) {
  const name=String(body.name||'').trim();
  const group=String(body.group||'').trim();
  const category=String(body.category||'').trim();
  const allowed={lecture1:true,lecture2:true};
  if(!name || !group || !allowed[category]) {
    return corsOutput({status:'error',message:'بيانات إعادة فتح الكويز ناقصة'});
  }

  const ss=sheet.getParent();
  const {is,qh}=ensureNewScoreSheets(ss);
  const rows=is.getDataRange().getValues();

  for(let i=rows.length-1;i>=1;i--) {
    if(String(rows[i][0]||'').trim().toLowerCase()===name.toLowerCase() &&
       String(rows[i][1]||'').trim().toLowerCase()===group.toLowerCase() &&
       String(rows[i][2]||'').trim()===category) {
      const oldScore=Number(rows[i][3]||0);
      const oldMax=Number(rows[i][4]||15);
      const submittedAt=String(rows[i][5]||'');
      qh.appendRow([name,group,category,oldScore,oldMax,submittedAt,new Date().toISOString()]);
      is.deleteRow(i+1);
      return corsOutput({
        status:'success',
        message:'تم إعادة فتح الكويز للطالب مع الاحتفاظ بسجل المحاولة السابقة.',
        category,
        previousAttempt:{score:oldScore,max:oldMax,submittedAt}
      });
    }
  }
  return corsOutput({
    status:'success',
    message:'لا توجد محاولة نشطة لهذا الكويز؛ الطالب يستطيع فتحه بالفعل.',
    category,
    reset:false
  });
}

function handleAdminSetScore(sheet, body) {
  const type=String(body.type||'').trim();
  const ss=sheet.getParent(); const {gs,is}=ensureNewScoreSheets(ss); const now=new Date().toISOString();
  if(type==='game') {
    const group=String(body.group||'').trim(), gameId=String(body.gameId||'').trim();
    const maxMap={hymn:15,pressure:15,sketch:30,studio:20,conferenceHymn:20};
    if(!group || maxMap[gameId]==null) return corsOutput({status:'error',message:'لعبة غير معروفة'});
    const max=maxMap[gameId], score=Math.max(0,Math.min(max,Number(body.score||0)));
    const row=findRowByPair(gs,1,group,2,gameId);
    if(row>0) gs.getRange(row,3,1,3).setValues([[score,max,now]]); else gs.appendRow([group,gameId,score,max,now]);
    return corsOutput({status:'success',message:'تم تعديل درجة اللعبة من لوحة الأدمن.',score,max});
  }
  if(type==='individual') {
    const name=String(body.name||'').trim(), group=String(body.group||'').trim(), category=String(body.category||'').trim();
    const max=Math.min(50,Math.max(0,Number(body.max||50))), score=Math.max(0,Math.min(max,Number(body.score||0)));
    if(!name || !group || !category) return corsOutput({status:'error',message:'بيانات الدرجة الفردية ناقصة'});
    const rows=is.getDataRange().getValues(); let row=-1;
    for(let i=1;i<rows.length;i++) if(
      String(rows[i][0]||'').trim().toLowerCase()===name.toLowerCase() &&
      String(rows[i][1]||'').trim().toLowerCase()===group.toLowerCase() &&
      String(rows[i][2]||'').trim()===category
    ){row=i+1;break;}
    if(row>0) is.getRange(row,1,1,6).setValues([[name,group,category,score,max,now]]); else is.appendRow([name,group,category,score,max,now]);
    return corsOutput({status:'success',message:'تم تعديل الدرجة الفردية من لوحة الأدمن.',score,max});
  }
  return corsOutput({status:'error',message:'نوع الدرجة غير معروف'});
}

function handleUpdateSiteConfig(sheet, body) {
  const key=String(body.key||'').trim(); if(!key) return corsOutput({status:'error',message:'مفتاح الإعداد مطلوب'});
  let value=body.value;
  if(key==='pamphletMax') value=Math.min(50,Math.max(0,Number(value||0)));
  else if(key==='groups' || key==='rooms') { value = (typeof body.value === 'string') ? JSON.parse(body.value) : body.value; }
  const ss=sheet.getParent(); const {cs}=ensureNewScoreSheets(ss); const rows=cs.getDataRange().getValues(); let row=-1;
  for(let i=1;i<rows.length;i++) if(String(rows[i][0]||'').trim()===key){row=i+1;break;}
  const serialized=(typeof value==='string')?value:JSON.stringify(value);
  const now=new Date().toISOString();
  if(row>0) cs.getRange(row,2,1,2).setValues([[serialized,now]]); else cs.appendRow([key,serialized,now]);
  return corsOutput({status:'success',message:'تم حفظ إعدادات الموقع.',key,value});
}
