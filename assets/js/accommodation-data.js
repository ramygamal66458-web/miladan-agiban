/* accommodation-data.js — النسخة المعتمدة من بيانات التسكين */
const rooms = [
  {
    "id": "r101",
    "name": "غرفة 101",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "مريم عادل",
      "ماروسكا عزت",
      "ماريفون عزت"
    ]
  },
  {
    "id": "r102",
    "name": "غرفة 102",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "نرمين صبحي",
      "جونير ريمون",
      "جومانا روماني"
    ]
  },
  {
    "id": "r103",
    "name": "غرفة 103",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "مريم نشأت",
      "ايلاريا نشأت",
      "بتول نشأت"
    ]
  },
  {
    "id": "r104",
    "name": "غرفة 104",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "مارينا عزيز",
      "جاسيكا ايمن",
      "ماريان حنا"
    ]
  },
  {
    "id": "r105",
    "name": "غرفة 105",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "تريزا سمير",
      "ميراكل زكريا",
      "مارينا مؤمن"
    ]
  },
  {
    "id": "r106",
    "name": "غرفة 106",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "جريانة جدعون",
      "ماريا ثروت",
      "ماريز ثروت"
    ]
  },
  {
    "id": "r107",
    "name": "غرفة 107",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "ماريا اشرف",
      "ماريا يوسف",
      "مريم عزت"
    ]
  },
  {
    "id": "r108",
    "name": "غرفة 108",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "سناء حبيب",
      "ايريني عاطف",
      "ميريام هاني"
    ]
  },
  {
    "id": "r109",
    "name": "غرفة 109",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "فريدة فؤاد",
      "ماريا اكرم",
      "جويس نبيل"
    ]
  },
  {
    "id": "r110",
    "name": "غرفة 110",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "دميانة القمص",
      "مارينا جورج"
    ]
  },
  {
    "id": "r111",
    "name": "غرفة 111",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "يوستينا عريان",
      "مريم بهجت",
      "مرولا عاطف"
    ]
  },
  {
    "id": "r112",
    "name": "غرفة 112",
    "floor": 1,
    "capacity": 6,
    "gender": "girls",
    "persons": [
      "ايريني مكرم",
      "مريم اميل",
      "ايريني بطرس",
      "ايريني القمص انيانوس"
    ]
  },
  {
    "id": "r201",
    "name": "غرفة 201",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "ابونا يحنس",
      "ماري سامي"
    ]
  },
  {
    "id": "r202",
    "name": "غرفة 202",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "ميراي كرم",
      "ميرولا الأمير",
      "ايريني رضا",
      "هيلبيس هاني",
      "دميانة بطرس",
      "ماري جمال"
    ]
  },
  {
    "id": "r203",
    "name": "غرفة 203",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "ميخائيل حلمي",
      "ماركو مكرم",
      "رافائيل هاني",
      "جون مجدي",
      "توني سامح"
    ]
  },
  {
    "id": "r204",
    "name": "غرفة 204",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "يونان عزيز",
      "كاراس أسامة",
      "توماس ريمون",
      "مينا مودي"
    ]
  },
  {
    "id": "r205",
    "name": "غرفة 205",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": []
  },
  {
    "id": "r206",
    "name": "غرفة 206",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": [],
    "note": "غرف الاباء"
  },
  {
    "id": "r207",
    "name": "غرفة 207",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "ايميل كامل",
      "كرم يواقيم",
      "المعلم روماني صفوت"
    ]
  },
  {
    "id": "r208",
    "name": "غرفة 208",
    "floor": 2,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "فرحة تامر",
      "جاكلين عريان"
    ]
  },
  {
    "id": "r301",
    "name": "غرفة 301",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "فادي نصيف",
      "جاسون جون",
      "عادل ميلاد"
    ]
  },
  {
    "id": "r302",
    "name": "غرفة 302",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "كيرلس موريس",
      "كيرلس سامي"
    ]
  },
  {
    "id": "r303",
    "name": "غرفة 303",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "فيلوباتير جورج",
      "اندرو سامح",
      "جورج سامح"
    ]
  },
  {
    "id": "r304",
    "name": "غرفة 304",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "ابانوب ناجي",
      "انطونيوس مينا",
      "مينا روماني"
    ]
  },
  {
    "id": "r305",
    "name": "غرفة 305",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "بولا عزيز",
      "موسي هاني",
      "جرجس هاني"
    ]
  },
  {
    "id": "r306",
    "name": "غرفة 306",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "افرام كرم",
      "مايكل بترو",
      "بيشوي الأمير"
    ]
  },
  {
    "id": "r307",
    "name": "غرفة 307",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "مينا جورج",
      "كيرلس ايميل",
      "جوفاني جورج"
    ]
  },
  {
    "id": "r308",
    "name": "غرفة 308",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "بيشوي عاطف",
      "يوسف جرجس",
      "كاراس يوسف"
    ]
  },
  {
    "id": "r309",
    "name": "غرفة 309",
    "floor": 3,
    "capacity": 6,
    "gender": "boys",
    "persons": [
      "ستيفين عصام",
      "بافلي اشرف",
      "كيرلس عاطف"
    ]
  }
];
window.rooms = rooms;
