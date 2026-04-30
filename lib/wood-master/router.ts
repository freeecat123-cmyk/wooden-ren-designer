/**
 * 木工大師客服 — 關鍵字路由
 *
 * 19 份知識檔案（~750KB / ~250K tokens）塞不進單次 prompt（Haiku 4.5 上限 200K
 * 但價格也不允許）。所以用 keyword 配對挑出 1-3 個最相關的檔案，再把那幾份
 * 全文塞進 system prompt。
 *
 * 詞表來源：knowledge/index.md 第二欄表格的關鍵字（手工抽取）。
 *
 * 評分原則：
 * - 字串包含命中（不分大小寫，但中文已是精確比對）→ +1 分
 * - 命中越多分數越高
 * - 平手時依優先順序（hand_tools / safety_workshop 排前面，比較常被問）
 *
 * fallback：完全沒命中就回 ["index.md"]，讓 LLM 看 TOC 自己挑題目方向。
 */

interface FileTopic {
  file: string;
  keywords: string[];
  priority: number; // 數字小的優先（平手時用）
}

const TOPICS: FileTopic[] = [
  {
    file: "hand_tools.md",
    priority: 1,
    keywords: [
      "鋸", "鑿", "刨", "鑽", "鑽頭", "鑽孔", "夾", "F夾", "F 夾", "磨刀", "水石", "油石", "砥石",
      "Z-Saw", "Z saw", "直角尺", "劃刀", "工作台", "Forstner", "電鑽", "電起子", "起子",
      "手工具", "西方鋸", "日鋸", "拉切", "推切", "card scraper", "刮刀",
    ],
  },
  {
    file: "machinery.md",
    priority: 2,
    keywords: [
      "桌鋸", "圓鋸", "圓鋸機", "帶鋸", "刨機", "jointer", "壓刨", "planer",
      "角鑿機", "mortiser", "砂磨", "sander", "修邊機", "router", "CNC",
      "雷射", "鑽床", "集塵", "table saw", "band saw", "machine", "機器",
      "TPI", "推板", "feather board", "羽毛板",
    ],
  },
  {
    file: "joinery.md",
    priority: 3,
    keywords: [
      "榫", "榫頭", "榫眼", "通榫", "盲榫", "鳩尾", "燕尾", "dovetail",
      "半搭", "半合", "指接", "finger joint", "企口", "T&G", "斜接",
      "miter", "木釘", "dowel", "餅乾", "biscuit", "Domino", "拼板", "夾合",
      "膠合", "PVA", "Titebond", "drawbore", "drawbored", "wedged",
    ],
  },
  {
    file: "wood_species.md",
    priority: 4,
    keywords: [
      "紅檜", "扁柏", "牛樟", "烏心石", "相思木", "相思", "楓香", "橡木",
      "楓木", "胡桃", "胡桃木", "櫻桃", "柚木", "松", "松木", "Janka",
      "含水率", "MC", "伸縮", "紋理", "徑切", "弦切", "木芯板", "夾板",
      "MDF", "板材", "木種", "樹種", "樹", "hinoki", "oak", "walnut",
      "cherry", "maple", "teak", "pine", "ash", "birch", "椴", "椴木",
      "basswood", "lime",
    ],
  },
  {
    file: "finishing.md",
    priority: 5,
    keywords: [
      "塗", "塗裝", "塗料", "上漆", "砂磨", "砂紙", "染色", "stain",
      "桐油", "亞麻仁", "亞麻仁油", "丹麥油", "Osmo", "PU", "聚氨酯",
      "蟲膠", "shellac", "蠟", "wax", "噴塗", "HVLP", "食品安全", "砧板",
      "戶外", "BLO", "varnish", "polyurethane", "wood finish", "上油",
    ],
  },
  {
    file: "safety_workshop.md",
    priority: 1, // 安全題優先
    keywords: [
      "安全", "PPE", "眼鏡", "耳罩", "口罩", "N95", "kickback", "回踢",
      "手套", "油布", "自燃", "火災", "集塵", "CFM", "工作室", "動線",
      "姿勢", "急救", "截指", "意外", "受傷", "防護",
    ],
  },
  {
    file: "structure_strength.md",
    priority: 6,
    keywords: [
      "撓度", "sag", "Sagulator", "MOE", "MOR", "彈性模數", "抗彎",
      "慣性矩", "層板", "塌", "桌腳", "橫撐", "牙條", "apron", "stretcher",
      "跨距", "邊條", "受力", "載重", "書架", "拉拔", "剪力", "結構",
      "強度", "支撐", "L over 360",
    ],
  },
  {
    file: "repair_restoration.md",
    priority: 7,
    keywords: [
      "開裂", "split", "crack", "翹曲", "cup", "bow", "twist", "蝴蝶榫",
      "butterfly key", "dutchman", "榫鬆", "loose tenon", "抽屜卡",
      "搖晃", "水痕", "熱痕", "白霧", "blooming", "草酸", "oxalic",
      "刮痕", "補土", "CA膠", "CA 膠", "環氧樹脂", "epoxy", "蟲蛀",
      "powderpost", "保固", "客戶投訴", "修補", "修復",
    ],
  },
  {
    file: "teaching_kids.md",
    priority: 8,
    keywords: [
      "小孩", "兒童", "親子", "分齡", "3歲", "5歲", "7歲", "10歲", "14歲",
      "Estwing", "Stanley Junior", "Lee Valley Apprentice", "CNS 4797",
      "ASTM F963", "EN71", "吞嚥", "教師比例", "家長簽訟", "兒童課",
      "教學", "幼兒", "青少年",
    ],
  },
  {
    file: "books_chinese_classics.md",
    priority: 9,
    keywords: [
      "王世襄", "明式家具", "明式家具研究", "明式家具珍賞", "阮章魁", "谷岸",
      "抱肩榫", "夾頭榫", "插肩榫", "霸王棖", "楔釘榫", "粽角榫", "走馬銷",
      "銀錠扣", "穿帶", "攢邊打槽", "攢邊", "圈椅", "官帽椅", "燈掛椅",
      "玫瑰椅", "八仙桌", "羅漢床", "架子床", "圓角櫃", "方角櫃", "黃花梨",
      "紫檀", "雞翅木", "鐵力木", "束腰", "明式", "中式", "案", "中式家具",
    ],
  },
  {
    file: "books_japanese_techniques.md",
    priority: 10,
    keywords: [
      "西岡常一", "小川三夫", "法隆寺", "棟梁", "宮大工", "鉋台", "鉋台直し",
      "裏出し", "裏金", "押え溝", "木殺し", "玄能", "削り台", "二段刃",
      "桂", "向待鑿", "薄鑿", "追入鑿", "突き鑿", "目立て", "替刃",
      "天然砥石", "合砥", "青砥", "渡り腮", "車知", "込栓", "鎌継ぎ",
      "千切り", "木表", "木裏", "逆目", "順目", "弟子", "一人前",
      "和鉋", "日鉋", "京都山城",
    ],
  },
  {
    file: "books_english_classics.md",
    priority: 11,
    keywords: [
      "Hoadley", "Understanding Wood", "Identifying Wood", "細胞壁",
      "microfibril", "微纖維", "free water", "bound water", "自由水",
      "結合水", "FSP", "纖維飽和點", "異向收縮", "Schwarz", "Anarchist",
      "Lost Art Press", "holdfast", "Roubo", "工作台高度", "leg vise",
      "Krenov", "Cabinetmaker", "Krenov plane", "木刨", "Flexner",
      "Wood Finishing", "evaporative", "reactive", "coalescing",
      "脫蠟蟲膠", "Odate", "kanna", "uradashi", "shokunin", "職人",
    ],
  },
  {
    file: "books_workshop_manuals.md",
    priority: 12,
    keywords: [
      "Tage Frid", "RISD", "Joinery Vol", "Furnituremaking", "丹麥油浸",
      "wet sanding slurry", "三腳凳", "drawbored", "Fine Woodworking",
      "FWW", "sharpening pyramid", "磨刀金字塔", "wood movement",
      "Titebond", "Sam Allen", "Andy Rae", "Albert Jackson", "David Day",
      "Kelly Mehler", "Table Saw Book", "thin strip", "resaw",
      "Nakashima", "Soul of a Tree", "live edge", "free edge",
      "butterfly", "book match", "slip match", "32mm system", "Euro hinge",
      "cup hinge", "杯孔", "32 mm",
    ],
  },
  {
    file: "books_taiwan_local.md",
    priority: 4, // 台灣題優先
    keywords: [
      "李乾朗", "林會承", "直探匠心", "台灣傳統建築", "大木作", "穿斗式",
      "抬樑式", "斗拱", "櫨斗", "栱", "鋪作", "藻井", "結網", "螺旋藻井",
      "王益順", "陳應彬", "葉金萬", "廖石成", "彬司", "益順", "對場作",
      "拚場", "通樑", "步通", "員光", "瓜筒", "趖瓜", "朝天宮", "龍山寺",
      "配天宮", "孔廟", "三大林場", "阿里山", "太平山", "八仙山",
      "1991", "禁伐", "貴重木", "台尺", "分", "寸", "才", "坪",
      "2400", "1200", "4×8", "4x8", "曲尺", "墨斗", "梄仔", "鉋仔",
      "鑿仔", "家私", "台語", "客家", "八腳眠床", "紅眠床", "公媽龕",
      "排灣", "魯凱", "達悟", "拼板舟", "丈竿", "篙尺", "廟", "廟宇",
      "6 分", "6分", "8 分", "8分",
    ],
  },
  {
    file: "books_woodturning.md",
    priority: 13,
    keywords: [
      "Raffan", "Mahoney", "Drozda", "Mark Baker", "Keith Rowley",
      "Spielman", "車旋", "車床", "lathe", "bowl gouge", "spindle gouge",
      "skew chisel", "scraper", "Ellsworth", "Wolverine", "Vari-Grind",
      "CBN", "Easy Wood", "碳化鎢", "bead", "cove", "fillet", "cabriole",
      "燭台", "陀螺", "コマ", "こけし", "tear-out", "shear cut",
      "shear scraping", "ABC 口訣", "Anchor Bevel", "steady rest",
      "endgrain bowl", "natural edge", "LDD", "DNA", "酒精乾燥",
      "木碗", "木盒", "木匙", "胡桃油", "Tried & True", "面罩", "AAW",
      "ANSI Z87", "catch", "skew catch", "龍眼木", "荔枝木",
    ],
  },
  {
    file: "books_woodcarving.md",
    priority: 14,
    keywords: [
      "Mary May", "Chris Pye", "Sayers", "Wilbur", "関侊雲", "松本明慶",
      "円空", "木喰", "木雕", "雕刻", "sweep", "曲度編號", "V-tool",
      "三角刀", "丸鑿", "平鑿", "gouge", "palm tools", "Pfeil", "Flexcut",
      "Two Cherries", "Stubai", "Henry Taylor", "strop", "honing compound",
      "chromium oxide", "slipstone", "in-cannel", "out-cannel",
      "relief", "浮雕", "低浮雕", "中浮雕", "高浮雕", "透雕", "bas-relief",
      "acanthus", "莨苕葉", "葉飾", "stop cut", "bosting", "grounding",
      "stippling", "matting punch", "圓雕", "in-the-round", "佛像", "仏像",
      "玉眼", "胡粉", "一刀彫", "寄木造", "内刳り", "慶派", "院派", "運慶",
      "快慶", "lettering", "字體", "Trajan", "東陽木雕", "樂清黃楊",
      "潮州", "莆田", "三義木雕", "鹿港", "錦森興", "李秉圭", "chip carving",
      "三刀切", "防割手套",
    ],
  },
  {
    file: "books_chairmaking.md",
    priority: 15,
    keywords: [
      "Jennie Alexander", "Drew Langsner", "Curtis Buchanan", "Peter Galbert",
      "Mike Abbott", "Lon Schleining", "Brian Boggs", "Mike Dunbar",
      "green wood", "生材", "post-and-rung", "梯背椅", "ladderback",
      "Windsor", "windsor", "sack-back", "continuous arm", "fan back",
      "comb back", "bow back", "splay", "rake", "sight line", "瞄線",
      "resultant angle", "saddle", "hip relief", "tapered tenon", "錐型榫",
      "reamer", "錐型鉸刀", "wedge", "spindle", "drawknife", "spokeshave",
      "輻刀", "travisher", "scorp", "inshave", "froe", "shave horse",
      "削馬", "adze", "bow saw", "弓鋸", "steam bending", "蒸彎",
      "compression strap", "white oak", "白橡", "milk paint", "牛奶漆",
      "椅匠",
    ],
  },
  {
    file: "books_design_proportions.md",
    priority: 16,
    keywords: [
      "By Hand & Eye", "Walker", "Tolpin", "視覺數學", "比例", "story stick",
      "dividers", "兩腳規", "sector", "三角規", "proportional dividers",
      "黃金比", "golden ratio", "1.618", "1:√2", "Vitruvius", "Palladio",
      "古典作圖", "Euclid", "n 等分", "Drawer Rule", "抽屜遞增",
      "4:5:6:7", "Roubo", "Moxon", "Astragal", "Ovolo", "Cyma", "線腳",
      "molding", "moulding", "scratch stock", "router profile", "ogee",
      "圭臬尺寸",
    ],
  },
  {
    file: "books_furniture_styles.md",
    priority: 17,
    keywords: [
      "Shaker", "夏克", "Kassay", "Handberg", "Becksvoort", "Mogensen",
      "wedged through-tenon", "tape seat", "紙繩編織", "oval box",
      "swallowtail", "Chippendale", "Director 1754", "cabriole leg",
      "ball-and-claw", "splat", "rococo", "chinoiserie", "Hepplewhite",
      "shield-back", "Sheraton", "Adam style", "Robert Adam",
      "Albert Sack", "Good Better Best", "Mission", "Stickley",
      "Gustav Stickley", "Craftsman", "quartersawn", "fumed oak",
      "fuming", "Greene & Greene", "Greene", "Gamble House", "cloud lift",
      "Mid-Century", "Hans Wegner", "Wegner", "CH24", "Y 椅", "Wishbone",
      "PP550", "Carl Hansen", "Kaare Klint", "Børge Mogensen",
      "Finn Juhl", "Eames", "LCW", "Eames Lounge", "Bauhaus", "包浩斯",
      "Walter Gropius", "Mies", "Adolf Loos", "Ornament is crime",
      "Form follows function", "Marcel Breuer", "Wassily", "Cesca",
      "Sam Maloof", "Wharton Esherick", "Wendell Castle", "James Krenov",
      "北歐風", "日式禪風", "Loft", "工業風", "美式鄉村", "現代簡約",
      "古典歐式", "新古典", "風格",
    ],
  },
];

/**
 * 從使用者問題挑出最相關的 1-3 份知識檔。
 *
 * 演算法：
 * 1. 對每個 file 的 keywords[] 算 query 中出現的命中次數
 * 2. 按命中數排序，再以 priority 號碼小的優先（平手）
 * 3. 命中數 ≥ 1 才算候選；最多取 3 份
 * 4. 全沒命中 → 回 ["index.md"]（讓 LLM 看 TOC 知道「我可能該翻哪份」）
 */
export function selectKnowledgeFiles(query: string): string[] {
  const q = query.toLowerCase();
  const scored = TOPICS.map((t) => {
    let hits = 0;
    for (const kw of t.keywords) {
      if (q.includes(kw.toLowerCase())) hits += 1;
    }
    return { file: t.file, hits, priority: t.priority };
  })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.priority - b.priority);

  if (scored.length === 0) return ["index.md"];
  return scored.slice(0, 3).map((s) => s.file);
}
