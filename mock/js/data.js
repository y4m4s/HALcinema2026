var MOVIES = [
  {
    id: 1,
    title: "ドールハウス",
    titleEn: "DOLL HOUSE",
    genre: ["ホラー", "サスペンス"],
    rating: "PG12",
    duration: 108,
    director: "内田英治",
    cast: ["桜田ひより", "伊藤沙莉", "宮沢氷魚", "松本まりか"],
    synopsis: "人形のように美しい少女・愛は、ある日突然、見知らぬ屋敷に閉じ込められる。そこには自分と瓜二つの「もうひとりの自分」が存在していた。二人の記憶が交差するとき、扉の向こうに隠された真実が姿を現す——。観る者の現実と幻の境界を溶かす、極上のサスペンス・ホラー。",
    image: "assets/images/dollhouse.webp",
    status: "now",
    screens: [1, 3],
    schedules: [["10:00","12:48"],["13:30","15:18"],["17:00","18:48"],["20:30","22:18"]],
    screenSchedules: [
      { screen: 1, slots: [
        { start: "10:00", end: "12:48", status: "soldout" },
        { start: "17:00", end: "18:48", status: "ok" }
      ]},
      { screen: 3, slots: [
        { start: "13:30", end: "15:18", status: "few" },
        { start: "20:30", end: "22:18", status: "ok" }
      ]}
    ],
    playingDays: [0,1,2,3,4,5,6],
    note: "PG12 指定作品。上映前に年齢確認を行う場合があります。",
    releaseDate: "2025.03.22",
    isFeature: true,
  },
  {
    id: 2,
    title: "カラダ探し",
    titleEn: "KARADA SAGASHI",
    genre: ["ホラー", "ループ"],
    rating: "R15+",
    duration: 113,
    director: "羽住英一郎",
    cast: ["橋本環奈", "眞栄田郷敦", "山本舞香", "神尾楓珠", "醍醐虎汰朗", "横田真悠"],
    synopsis: "毎晩繰り返される同じ悪夢。バラバラになったカラダのパーツを夜明けまでに集めなければ、永遠に終わらないループが続く。恐怖の呪いに囚われた高校生6人の、極限の一夜が始まる。",
    image: "assets/images/karada.webp",
    status: "now",
    screens: [2, 5],
    schedules: [["11:20","13:13"],["14:50","16:43"],["18:30","20:23"]],
    screenSchedules: [
      { screen: 2, slots: [
        { start: "11:20", end: "13:13", status: "soldout" },
        { start: "18:30", end: "20:23", status: "ok" }
      ]},
      { screen: 5, slots: [
        { start: "14:50", end: "16:43", status: "few" }
      ]}
    ],
    playingDays: [0,1,2,3,4,5],
    note: "R15+ 指定作品。15歳未満のご入場はできません。",
    releaseDate: "2022.10.28",
    isFeature: false,
  },
  {
    id: 3,
    title: "プー2 あくまのくまさんとじゃあくななかまたち",
    titleEn: "WINNIE-THE-POOH: BLOOD AND HONEY 2",
    genre: ["ホラー", "スラッシャー"],
    rating: "R15+",
    duration: 93,
    director: "Rhys Frake-Waterfield",
    cast: ["Scott Chambers", "Tallulah Evans", "Simon Callow", "Mabel Tyler"],
    synopsis: "悪夢はまだ、はじまったばかり——。プーさんと仲間たちが再び現れ、血塗られた惨劇を繰り広げる。前作をはるかに凌ぐド迫力の血しぶき&殺戮の嵐が日本を震撼させる。",
    image: "assets/images/pooh.webp",
    status: "now",
    screens: [4, 6],
    schedules: [["12:00","13:33"],["16:20","17:53"],["20:00","21:33"]],
    screenSchedules: [
      { screen: 4, slots: [
        { start: "12:00", end: "13:33", status: "ok" },
        { start: "20:00", end: "21:33", status: "ok" }
      ]},
      { screen: 6, slots: [
        { start: "16:20", end: "17:53", status: "soldout" }
      ]}
    ],
    playingDays: [2,3,4,5,6],
    note: "",
    releaseDate: "2024.06.21",
    isFeature: false,
  },
  {
    id: 6,
    title: "霧の向こう",
    titleEn: "BEYOND THE FOG",
    genre: ["ホラー", "オカルト"],
    rating: "R15+",
    duration: 99,
    director: "清水崇",
    cast: ["松岡茉優", "岡田将生", "黒木華"],
    synopsis: "山中の廃村に踏み込んだ4人の若者たち。霧が立ち込めるにつれ、村人の亡霊が次々と姿を現す。逃げようとするたびに同じ場所へ戻される、終わりなき恐怖の迷宮。",
    image: null,
    status: "now",
    screens: [2, 7],
    schedules: [],
    screenSchedules: [
      { screen: 2, slots: [
        { start: "10:30", end: "12:09", status: "soldout" },
        { start: "13:00", end: "14:39", status: "few" },
        { start: "19:00", end: "20:39", status: "ok" }
      ]},
      { screen: 7, slots: [
        { start: "11:00", end: "12:39", status: "ok" },
        { start: "14:00", end: "15:39", status: "soldout" },
        { start: "20:00", end: "21:39", status: "ok" }
      ]}
    ],
    playingDays: [0,1,3,4,5],
    note: "R15+ 指定作品。強度の恐怖・暗闇描写があります。",
    releaseDate: "2026.04.18",
    isFeature: false,
  },
  {
    id: 7,
    title: "地獄の回廊",
    titleEn: "CORRIDOR OF HELL",
    genre: ["スラッシャー", "アクション"],
    rating: "R18+",
    duration: 87,
    director: "三池崇史",
    cast: ["綾野剛", "浜辺美波", "柄本佑", "水川あさみ"],
    synopsis: "廃病院を舞台にした生存ゲーム。参加者は12人——脱出できるのは果たして何人か。容赦ない罠と狂気の番人が待ち受ける、一夜限りの死闘。",
    image: null,
    status: "now",
    screens: [3, 8],
    schedules: [],
    screenSchedules: [
      { screen: 3, slots: [
        { start: "09:50", end: "11:17", status: "ok" },
        { start: "12:30", end: "13:57", status: "soldout" },
        { start: "16:00", end: "17:27", status: "few" },
        { start: "20:30", end: "21:57", status: "ok" }
      ]},
      { screen: 8, slots: [
        { start: "10:20", end: "11:47", status: "few" },
        { start: "13:00", end: "14:27", status: "ok" },
        { start: "17:30", end: "18:57", status: "soldout" },
        { start: "21:00", end: "22:27", status: "ok" }
      ]}
    ],
    playingDays: [3,4,5,6],
    note: "R18+ 指定作品。18歳未満は入場不可。グロテスクな描写を含みます。",
    releaseDate: "2026.05.02",
    isFeature: false,
  },
  {
    id: 4,
    title: "呪縛の家",
    titleEn: "THE CURSED HOUSE",
    genre: ["ホラー", "ミステリー"],
    rating: "PG12",
    duration: 105,
    director: "未定",
    cast: [],
    synopsis: "取り壊しが予定された廃屋。その地下室から発見された古い日記が、一家を消えさせた50年前の事件を暴く。",
    image: null,
    status: "coming",
    releaseDate: "2025.06.07",
    isFeature: false,
  },
  {
    id: 5,
    title: "深淵より",
    titleEn: "FROM THE ABYSS",
    genre: ["サスペンス", "スリラー"],
    rating: "R15+",
    duration: 120,
    director: "未定",
    cast: [],
    synopsis: "深海調査船が引き上げた謎の物体。乗組員が一人ずつ姿を消す中、船内に潜む恐怖の正体に迫る。",
    image: null,
    status: "coming",
    releaseDate: "2025.07.19",
    isFeature: false,
  },
];

var NEWS = [
  { id:1, date:"2025.04.20", tag:"お知らせ", title:"GWスペシャル「ドールハウス」舞台挨拶 — 5月3日(土)開催決定" },
  { id:2, date:"2025.04.15", tag:"イベント", title:"第3回 HALシネマ ホラー映画祭 2025年6月開催決定" },
  { id:3, date:"2025.04.10", tag:"キャンペーン", title:"毎月13日は「呪いのサービスデー」— 全作品1,300円均一" },
  { id:4, date:"2025.04.01", tag:"お知らせ", title:"スクリーン7・8リニューアル完了 — 最新ドルビーアトモス導入" },
  { id:5, date:"2025.03.28", tag:"メンテナンス", title:"4月8日(火)システムメンテナンスのため終日休業" },
];

var SCREENS = [
  { num:1, type:"大スクリーン", seats:200, features:["Dolby Atmos","4K レーザープロジェクター","バリアフリー対応","車椅子スペース 4席"] },
  { num:2, type:"大スクリーン", seats:200, features:["Dolby Atmos","4K レーザープロジェクター","バリアフリー対応"] },
  { num:3, type:"大スクリーン", seats:200, features:["IMAX互換スクリーン","Dolby Atmos","4K レーザープロジェクター"] },
  { num:4, type:"中スクリーン", seats:120, features:["Dolby Digital","4K プロジェクター","バリアフリー対応"] },
  { num:5, type:"中スクリーン", seats:120, features:["Dolby Digital","4K プロジェクター"] },
  { num:6, type:"小スクリーン", seats:70,  features:["7.1ch サラウンド","2K プロジェクター"] },
  { num:7, type:"小スクリーン", seats:70,  features:["Dolby Atmos","4K レーザープロジェクター (NEW)"] },
  { num:8, type:"小スクリーン", seats:70,  features:["Dolby Atmos","4K レーザープロジェクター (NEW)","バリアフリー対応"] },
];

var PRICES = [
  { cat:"一般", price:"1,800円", note:"" },
  { cat:"大学生・専門学生", price:"1,600円", note:"学生証提示" },
  { cat:"中学・高校生", price:"1,400円", note:"学生証提示" },
  { cat:"小学生・幼児", price:"1,000円", note:"" },
  { cat:"シニア（60歳以上）", price:"1,200円", note:"身分証提示" },
  { cat:"障がい者", price:"1,000円", note:"手帳提示、同伴者1名も同額" },
  { cat:"3D 追加料金", price:"+400円", note:"対象作品のみ" },
  { cat:"呪いのサービスデー（毎月13日）", price:"1,300円", note:"全席・全年齢均一" },
];

var DATES = ["5/12(火)","5/13(水)","5/14(木)","5/15(金)","5/16(土)","5/17(日)","5/18(月)"];
