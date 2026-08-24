/* برنامج مؤتمر ميلادا عجيبًا — 24 إلى 26 أغسطس 2026 */
const programDataSeed = [
  {
    "id": "d1-a1",
    "day": 1,
    "title": "التجمع",
    "type": "event",
    "time": "06:30",
    "endTime": "07:30",
    "place": "مكان التجمع",
    "notes": "التجمع والاستعداد للتحرك"
  },
  {
    "id": "d1-a2",
    "day": 1,
    "title": "التحرك والوصول",
    "type": "travel",
    "time": "07:30",
    "endTime": "09:00",
    "place": "البيت",
    "notes": "التحرك والوصول إلى بيت الماء الحي"
  },
  {
    "id": "d1-a3",
    "day": 1,
    "title": "تحفيظ الشعار واللحن",
    "type": "other",
    "time": "09:00",
    "endTime": "11:00",
    "place": "القاعة",
    "notes": "تحفيظ شعار المؤتمر ولحن المؤتمر"
  },
  {
    "id": "d1-a4",
    "day": 1,
    "title": "تسكين وفطار",
    "type": "meal",
    "time": "11:00",
    "endTime": "12:00",
    "place": "المطعم والغرف",
    "notes": "التسكين ووجبة الإفطار"
  },
  {
    "id": "d1-a5",
    "day": 1,
    "title": "المحاضرة الأولى — القمص منسي عزيز",
    "type": "lecture",
    "time": "12:00",
    "endTime": "13:00",
    "place": "القاعة الرئيسية",
    "speaker": "القمص منسي عزيز",
    "speakerImg": "../assets/img/fr-mansi-aziz.jpg",
    "linkedId": "d1-l1"
  },
  {
    "id": "d1-a6",
    "day": 1,
    "title": "ورش عمل (ثلاث فقرات)",
    "type": "workshop",
    "time": "13:00",
    "endTime": "15:00",
    "place": "قاعات الورش",
    "notes": "ثلاث فقرات تفاعلية"
  },
  {
    "id": "d1-a7",
    "day": 1,
    "title": "غداء وراحة",
    "type": "meal",
    "time": "15:00",
    "endTime": "16:00",
    "place": "المطعم والغرف",
    "notes": "غداء ثم راحة"
  },
  {
    "id": "d1-a8",
    "day": 1,
    "title": "حمام سباحة للبنين",
    "type": "free",
    "time": "16:00",
    "endTime": "18:30",
    "place": "حمام السباحة",
    "notes": "فترة السباحة للبنين"
  },
  {
    "id": "d1-a9",
    "day": 1,
    "title": "راحة",
    "type": "free",
    "time": "18:30",
    "endTime": "19:00",
    "place": "الغرف",
    "notes": ""
  },
  {
    "id": "d1-a10",
    "day": 1,
    "title": "غروب ونوم",
    "type": "prayer",
    "time": "19:00",
    "endTime": "19:30",
    "place": "البيت",
    "notes": ""
  },
  {
    "id": "d1-a11",
    "day": 1,
    "title": "عشاء",
    "type": "meal",
    "time": "19:30",
    "endTime": "20:30",
    "place": "المطعم",
    "notes": ""
  },
  {
    "id": "d1-a12",
    "day": 1,
    "title": "فقرة حرة في الملعب",
    "type": "event",
    "time": "22:30",
    "endTime": "24:30",
    "place": "الملعب",
    "notes": "فقرة حرة حسب التعديل المكتوب على البرنامج"
  },
  {
    "id": "d2-a1",
    "day": 2,
    "title": "صلاة باكر",
    "type": "prayer",
    "time": "07:00",
    "endTime": "08:00",
    "place": "القاعة",
    "notes": "صلاة باكر"
  },
  {
    "id": "d2-a2",
    "day": 2,
    "title": "صلاة باكر وتسبيحة باكر",
    "type": "prayer",
    "time": "08:00",
    "endTime": "09:00",
    "place": "القاعة",
    "notes": ""
  },
  {
    "id": "d2-a3",
    "day": 2,
    "title": "تحفيظ الشعار واللحن 2",
    "type": "other",
    "time": "09:00",
    "endTime": "10:30",
    "place": "القاعة",
    "notes": "مراجعة الشعار واللحن"
  },
  {
    "id": "d2-a4",
    "day": 2,
    "title": "الفطار",
    "type": "meal",
    "time": "10:30",
    "endTime": "11:30",
    "place": "المطعم",
    "notes": ""
  },
  {
    "id": "d2-a5",
    "day": 2,
    "title": "المحاضرة الثانية — القمص موريس حمدي",
    "type": "lecture",
    "time": "11:30",
    "endTime": "12:30",
    "place": "القاعة الرئيسية",
    "speaker": "القمص موريس حمدي",
    "speakerImg": "../assets/img/fr-morris-hamdy.jpg",
    "linkedId": "d2-l1"
  },
  {
    "id": "d2-a6",
    "day": 2,
    "title": "ورش عمل (ثلاث فقرات)",
    "type": "workshop",
    "time": "13:00",
    "endTime": "15:00",
    "place": "قاعات الورش",
    "notes": "ثلاث فقرات تفاعلية"
  },
  {
    "id": "d2-a7",
    "day": 2,
    "title": "غداء وراحة",
    "type": "meal",
    "time": "15:00",
    "endTime": "16:00",
    "place": "المطعم والغرف",
    "notes": ""
  },
  {
    "id": "d2-a8",
    "day": 2,
    "title": "حمام سباحة للبنات",
    "type": "free",
    "time": "16:00",
    "endTime": "18:30",
    "place": "حمام السباحة",
    "notes": "فترة السباحة للبنات"
  },
  {
    "id": "d2-a9",
    "day": 2,
    "title": "راحة",
    "type": "free",
    "time": "18:30",
    "endTime": "19:30",
    "place": "الغرف",
    "notes": ""
  },
  {
    "id": "d2-a10",
    "day": 2,
    "title": "عشاء",
    "type": "meal",
    "time": "19:30",
    "endTime": "20:30",
    "place": "المطعم",
    "notes": ""
  },
  {
    "id": "d2-a11",
    "day": 2,
    "title": "حفلة السمر",
    "type": "event",
    "time": "22:30",
    "endTime": "24:00",
    "place": "قاعة السمر",
    "notes": "الفقرة الختامية المسائية"
  },
  {
    "id": "d3-a1",
    "day": 3,
    "title": "فقرة صباحية",
    "type": "event",
    "time": "06:00",
    "endTime": "07:00",
    "place": "القاعة",
    "notes": "حسب التعديل المكتوب على البرنامج"
  },
  {
    "id": "d3-a2",
    "day": 3,
    "title": "القداس",
    "type": "prayer",
    "time": "07:00",
    "endTime": "09:00",
    "place": "الكنيسة",
    "notes": ""
  },
  {
    "id": "d3-a3",
    "day": 3,
    "title": "الفطار",
    "type": "meal",
    "time": "09:00",
    "endTime": "10:00",
    "place": "المطعم",
    "notes": ""
  },
  {
    "id": "d3-a4",
    "day": 3,
    "title": "إعلان النتائج والتصوير",
    "type": "event",
    "time": "10:00",
    "endTime": "12:00",
    "place": "القاعة",
    "notes": "إعلان النتائج والتصوير الختامي"
  }
];
window.programData = programDataSeed;
