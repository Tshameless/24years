export type FoodCategory =
  | '肉蛋海鲜'
  | '乳品奶酪'
  | '饮品咖啡因'
  | '蔬果主食'
  | '调味零食'
  | '绝对红线';

export type FoodSafetyLevel = 'safe' | 'caution' | 'avoid';

export interface FoodSafetyItem {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly category: FoodCategory;
  readonly level: FoodSafetyLevel;
  readonly summary: string;
  readonly evidenceNote: string;
}

export interface SupplementClockTemplate {
  readonly id: string;
  readonly timeLabel: string;
  readonly taskTitle: string;
  readonly rationale: string;
}

export const foodCategories: readonly FoodCategory[] = [
  '肉蛋海鲜',
  '乳品奶酪',
  '饮品咖啡因',
  '蔬果主食',
  '调味零食',
  '绝对红线',
];

export const foodSafetyLabels: Record<FoodSafetyLevel, string> = {
  safe: '放心享用',
  caution: '适量注意',
  avoid: '明确避免',
};

// Evidence-based dietary safety reference (WHO / ACOG / Chinese Dietary Guidelines); zero folk myths.
export const foodSafetyItems: readonly FoodSafetyItem[] = [
  {
    id: 'cooked-crab-shrimp',
    name: '彻底煮熟的螃蟹与虾贝',
    aliases: ['大闸蟹', '海虾', '基围虾', '扇贝', '蛤蜊', '海鲜'],
    category: '肉蛋海鲜',
    level: 'safe',
    summary: '优质蛋白、DHA 与锌来源，彻底加热熟透且不过敏即可正常食用。',
    evidenceNote:
      '现代医学证实“吃螃蟹导致流产”并无科学依据；真正风险仅来自未煮熟引发的副溶血性弧菌/寄生虫感染或个人甲壳类过敏。',
  },
  {
    id: 'low-mercury-fish',
    name: '三文鱼、鳕鱼、鲈鱼等低汞熟鱼',
    aliases: ['深海鱼', '黄花鱼', '带鱼', '鲳鱼', 'DHA'],
    category: '肉蛋海鲜',
    level: 'safe',
    summary: '建议每周摄入 2–3 次（约 200–350g）彻底做熟的低汞鱼类。',
    evidenceNote:
      '富含 ω-3 多不饱和脂肪酸（DHA）与优质蛋白，有益胎儿视网膜与神经发育；请务必全熟烹饪，避免生食刺身。',
  },
  {
    id: 'cooked-red-meat',
    name: '全熟瘦牛羊肉与禽肉',
    aliases: ['牛肉', '羊肉', '鸡胸肉', '鸭肉', '猪肉', '红肉'],
    category: '肉蛋海鲜',
    level: 'safe',
    summary: '孕中晚期预防缺铁性贫血的核心血红素铁来源。',
    evidenceNote:
      '吃羊肉不会导致胎儿“羊癫疯”（癫痫与饮食无关）；烹饪时确保中心温度达标、无血丝，预防弓形虫感染。',
  },
  {
    id: 'fully-cooked-eggs',
    name: '全熟鸡蛋与蛋制品',
    aliases: ['水煮蛋', '蒸蛋羹', '炒蛋'],
    category: '肉蛋海鲜',
    level: 'safe',
    summary: '富含胆碱、卵磷脂与优质完全蛋白，蛋黄凝固即可放心吃。',
    evidenceNote: '避免溏心蛋、生鸡蛋拌饭或自制含生蛋黄的提拉米苏/蛋黄酱，以防沙门氏菌感染。',
  },
  {
    id: 'deli-cold-cuts',
    name: '冷藏即食火腿、卤味与冷切熟食',
    aliases: ['烟熏三文鱼', '冷盘', '即食香肠', '凉拌熟食'],
    category: '肉蛋海鲜',
    level: 'caution',
    summary: '食用前必须彻底复热至滚烫冒热气。',
    evidenceNote:
      '单增李斯特菌可在冰箱冷藏温度（4℃）下继续繁殖；彻底加热（中心温度 ≥70℃）即可有效灭活。',
  },
  {
    id: 'animal-liver',
    name: '动物肝脏（猪肝、鸡肝、鹅肝）',
    aliases: ['内脏', '猪血', '鸭血'],
    category: '肉蛋海鲜',
    level: 'caution',
    summary: '富含铁但维生素 A（视黄醇）极高，孕早期不宜高频大量食用。',
    evidenceNote:
      '过量预成维生素 A 有潜在致畸风险；如需食补铁，建议每次 25–50g、每月不超过 2–3 次，优先选瘦红肉或动物血制品。',
  },
  {
    id: 'pasteurized-dairy',
    name: '巴氏杀菌鲜奶、常温纯牛奶与酸奶',
    aliases: ['纯牛奶', '无糖酸奶', '低脂奶', '冷藏牛奶'],
    category: '乳品奶酪',
    level: 'safe',
    summary: '每日推荐 300–500g 奶制品，是孕期最稳定高效的钙来源。',
    evidenceNote:
      '配料表标注“巴氏杀菌乳”或“灭菌乳”均安全可靠；只要肠胃耐受，冷藏温度饮用不会影响子宫或胎儿。',
  },
  {
    id: 'pasteurized-cheese',
    name: '巴氏杀菌硬质奶酪与再制干酪',
    aliases: ['切达奶酪', '马苏里拉', '奶酪棒', '芝士片'],
    category: '乳品奶酪',
    level: 'safe',
    summary: '核对配料表确认采用巴氏杀菌乳制作即可安全食用（留意钠含量）。',
    evidenceNote:
      '避免未经巴氏杀菌的软质霉菌熟化奶酪（如生乳布里 Brie、卡门培尔、蓝纹奶酪），以防李斯特菌风险。',
  },
  {
    id: 'coffee-tea',
    name: '咖啡与茶饮（控制每日咖啡因总量）',
    aliases: ['拿铁', '美式咖啡', '奶茶', '绿茶', '红茶', '可乐'],
    category: '饮品咖啡因',
    level: 'caution',
    summary: '每日咖啡因总摄入量控制在 200 mg 以内（约 1 中杯美式或拿铁）。',
    evidenceNote:
      'ACOG 等循证指南表明每日 <200 mg 咖啡因不增加流产或早产风险；需同步计入浓茶、奶茶、可乐与黑巧克力中的咖啡因，且避免与铁剂同服。',
  },
  {
    id: 'ice-water-cold-drinks',
    name: '卫生达标的冰水与冷饮',
    aliases: ['冰块', '冷开水', '冰淇淋'],
    category: '饮品咖啡因',
    level: 'caution',
    summary: '无不洁微生物污染且肠胃无不适时可少量饮用，注意控糖。',
    evidenceNote:
      '消化道与生殖道互不相通，冷饮在口腔与食道即被迅速加温；所谓风险仅来自开封久置冷饮的李斯特菌及高糖热量负担。',
  },
  {
    id: 'unwashed-cut-melon',
    name: '超市预切果盘与久置切块西瓜',
    aliases: ['哈密瓜切块', '鲜榨街边果汁', '沙拉吧'],
    category: '蔬果主食',
    level: 'caution',
    summary: '优先买整果居家流动水刷洗表皮后现切现吃。',
    evidenceNote:
      '瓜果表皮细菌易在切开时带入果肉并在冷藏中滋生；处理果蔬请使用与生肉分开的专用砧板和刀具。',
  },
  {
    id: 'papaya-hawthorn-pineapple',
    name: '成熟木瓜、菠萝、山楂与桂圆',
    aliases: ['芒果', '榴莲', '荔枝', '西瓜'],
    category: '蔬果主食',
    level: 'safe',
    summary: '日常水果份量（每日 200–350g）内完全可以正常吃，留意糖分即可。',
    evidenceNote:
      '日常食用成熟水果远达不到药理刺激宫缩剂量；孕中晚期需控制高 GI 或高糖水果（如榴莲、荔枝）单次摄入量以平稳血糖。',
  },
  {
    id: 'whole-grains-beans',
    name: '燕麦、糙米、杂豆与薯类主食',
    aliases: ['全麦面包', '玉米', '鹰嘴豆', '红薯', '藜麦'],
    category: '蔬果主食',
    level: 'safe',
    summary: '建议粗杂粮占每日主食 1/3 左右，富含膳食纤维与 B 族维生素。',
    evidenceNote: '延缓餐后血糖上升幅度，并有效缓解孕中晚期常见的肠道蠕动减慢与便秘。',
  },
  {
    id: 'raw-sprouts',
    name: '生豆芽与未洗净生食芽苗菜',
    aliases: ['绿豆芽', '苜蓿芽', '黄豆芽'],
    category: '蔬果主食',
    level: 'caution',
    summary: '务必充分炒熟或焯透后再吃，不宜生拌。',
    evidenceNote:
      '芽菜温暖潮湿的培育环境易让大肠杆菌或沙门氏菌进入种子内部，仅靠清水冲洗难以彻底去除。',
  },
  {
    id: 'spicy-seasoning',
    name: '适量葱姜蒜、胡椒与微辣家常菜',
    aliases: ['辣椒', '咖喱', '花椒', '醋'],
    category: '调味零食',
    level: 'safe',
    summary: '无胃灼热、反酸或痔疮不适时可按平时习惯适度调味。',
    evidenceNote:
      '辛辣饮食不会造成所谓“胎毒”（新生儿湿疹/粟粒疹与母体吃辣无关）；但重油高盐易加重水肿与胃食管反流，宜清淡少盐。',
  },
  {
    id: 'nuts-dark-chocolate',
    name: '原味坚果与适量黑巧克力',
    aliases: ['核桃', '巴旦木', '开心果', '腰果'],
    category: '调味零食',
    level: 'safe',
    summary: '坚果每日一小把（约 10–15g）即可，优选原味无盐非油炸。',
    evidenceNote: '提供不饱和脂肪酸与维生素 E，但能量密度高，过量食用易导致孕期体重增长过快。',
  },
  {
    id: 'raw-meat-sashimi-milk',
    name: '生鱼片刺身、生腌海鲜、三分熟牛排与生鲜散装奶',
    aliases: ['醉虾', '醉蟹', '生蚝生吃', '鞑靼牛肉', '现挤羊奶'],
    category: '绝对红线',
    level: 'avoid',
    summary: '孕期全程严格避免一切生食或未熟透肉蛋海鲜与未杀菌生乳。',
    evidenceNote:
      '存在弓形虫、单增李斯特菌、沙门氏菌及布鲁氏菌感染风险，可能穿过胎盘屏障危及胎儿安全。',
  },
  {
    id: 'high-mercury-fish',
    name: '鲨鱼、剑鱼、旗鱼、方头鱼与大眼金枪鱼',
    aliases: ['马林鱼', '大王鲭', '鱼翅'],
    category: '绝对红线',
    level: 'avoid',
    summary: '处于海洋食物链顶端，甲基汞富集度高，孕期与哺乳期应避免食用。',
    evidenceNote: '过量甲基汞具有神经毒性，可能影响胎儿发育中的中枢神经系统。',
  },
  {
    id: 'alcohol-liquor-wine',
    name: '一切含酒精饮品及未完全挥发酒精的酒糟/醉菜',
    aliases: ['红酒', '啤酒', '米酒', '醪糟', '果酒', '鸡尾酒'],
    category: '绝对红线',
    level: 'avoid',
    summary: '孕期不存在任何“安全饮酒阈值”，全程零酒精。',
    evidenceNote:
      '乙醇可自由通过胎盘进入胎儿循环，任何孕周饮酒均可能增加胎儿酒精谱系障碍（FASD）与发育受损风险；月子米酒/醪糟催乳同样无科学依据且含酒精。',
  },
  {
    id: 'unverified-herbal-tonics',
    name: '不明成分药膳、偏方草药与所谓“去胎毒/保胎”汤剂',
    aliases: ['人参大补汤', '偏方凉茶', '自制药酒', '草药补品'],
    category: '绝对红线',
    level: 'avoid',
    summary: '严禁自行服用未经现代循证药理与妊娠安全性验证的草药或偏方。',
    evidenceNote:
      '部分植物提取物含肝肾毒性成分或子宫平滑肌刺激物，缺乏妊娠期药代动力学与致畸安全性数据；任何营养素与药物补充均以产科医生处方为准。',
  },
];

// Evidence-based staggered supplement schedule: calcium & iron compete for DMT1 intestinal transport.
export const supplementClockTemplates: readonly SupplementClockTemplate[] = [
  {
    id: 'morning-folate-d',
    timeLabel: '08:30 早餐随餐',
    taskTitle: '08:30 早餐随餐：叶酸 / 复合维生素或维生素 D（遵医嘱）',
    rationale: '脂溶性维生素 D 随含适量油脂的早餐吸收更佳，固定晨间时段不易漏服。',
  },
  {
    id: 'afternoon-iron-vc',
    timeLabel: '13:30 午餐后 / 午后',
    taskTitle: '13:30 午后错峰：铁剂搭配鲜果维 C（与钙奶/茶咖间隔 ≥2h，遵医嘱）',
    rationale:
      '维生素 C 促进非血红素铁还原吸收；与牛奶、钙片及含单宁/咖啡因饮品错开 2 小时以上可减少二价阳离子竞争。',
  },
  {
    id: 'evening-calcium',
    timeLabel: '21:00 晚餐后 / 睡前',
    taskTitle: '21:00 晚间错峰：钙剂补充（与铁剂错开 ≥2h，遵医嘱）',
    rationale: '晚间与午后铁剂充分错峰，兼顾孕中晚期每日钙需求与夜间骨骼钙代谢。',
  },
];

export function filterFoodSafetyItems(
  query: string,
  category: FoodCategory | 'all' = 'all',
  level: FoodSafetyLevel | 'all' = 'all',
): FoodSafetyItem[] {
  const normalized = query.trim().toLowerCase();

  return foodSafetyItems.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }

    if (level !== 'all' && item.level !== level) {
      return false;
    }

    if (!normalized) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(normalized) ||
      item.category.toLowerCase().includes(normalized) ||
      item.summary.toLowerCase().includes(normalized) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(normalized))
    );
  });
}
