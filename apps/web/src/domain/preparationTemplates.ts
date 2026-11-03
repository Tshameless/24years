// Organizational prompts, not a clinical schedule or a mandatory shopping list.
export const packingTemplates = [
  {
    title: '证件与就诊资料袋',
    notes: '按医院清单核对证件、预约信息和既往报告；存放位置：',
    category: '证件资料',
    quantity: 1,
  },
  {
    title: '个人洗漱与换洗用品',
    notes: '先核对医院提供的用品，避免重复购买；存放位置：',
    category: '妈妈用品',
    quantity: 1,
  },
  {
    title: '宝宝出院衣物',
    notes: '根据天气与医院要求准备；存放位置：',
    category: '宝宝用品',
    quantity: 1,
  },
  {
    title: '手机充电与交通准备',
    notes: '确认充电设备、接送联系人和就医路线；存放位置：',
    category: '证件资料',
    quantity: 1,
  },
] as const;

export const checkupTemplates = [
  {
    title: '首次就诊资料核对',
    notes: '预约日期以医院确认为准。整理既往病史、用药清单与已有报告；记录想询问医生的问题。',
  },
  {
    title: '复诊与报告沟通',
    notes:
      '带上本次及既往报告，记录需要解释的结果、后续安排和下一次预约日期。检查前准备请单独向医院确认。',
  },
  {
    title: '分娩与住院准备沟通',
    notes:
      '向医院确认入院流程、联系人、待产物品及个人分娩意愿的沟通方式。不预设分娩方式或医疗处置。',
  },
] as const;

export interface PackingPresetItem {
  readonly title: string;
  readonly category: string;
  readonly quantity: number;
  readonly defaultRole: 'mother' | 'partner';
  readonly notes: string;
}

export interface PackingPresetBundle {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly items: readonly PackingPresetItem[];
}

// Evidence-based, hospital-first organizational bundles; local reimbursement policies vary by region.
export const packingPresetBundles: readonly PackingPresetBundle[] = [
  {
    id: 'documents-insurance',
    title: '入院与生育报销材料袋',
    summary:
      '就诊证件、既往产检报告及出院结算/生育报销常见核对件（具体政策以参保地与医院窗口为准）',
    items: [
      {
        title: '身份证原件及复印件、医保卡/电子医保凭证',
        category: '证件资料',
        quantity: 1,
        defaultRole: 'partner',
        notes: '放入透明拉链文件袋，确认手机电子医保码可正常展码；急诊与住院登记必带。',
      },
      {
        title: '母子健康手册与全套产检报告单',
        category: '证件资料',
        quantity: 1,
        defaultRole: 'partner',
        notes:
          '按时间倒序整理血型、感染四项、B 超、GBS、凝血及心电图等原件，便于值班医生快速查阅。',
      },
      {
        title: '生育登记/准生证明与结婚证（按当地要求）',
        category: '证件资料',
        quantity: 1,
        defaultRole: 'partner',
        notes: '提前向参保地医保局或医院医保窗口确认联网结算与生育医疗费报销所需原件/电子证照。',
      },
      {
        title: '出院发票、费用清单与诊断证明收纳袋',
        category: '证件资料',
        quantity: 1,
        defaultRole: 'partner',
        notes: '出院结算后妥善留存盖章原件，用于后续生育医疗报销、生育津贴申领或商业保险理赔核对。',
      },
    ],
  },
  {
    id: 'mother-care',
    title: '妈妈待产与产后护理包',
    summary: '产房补能、产后恶露清洁与舒适住院换洗（先核对建档医院待产包已有物品，避免重复采购）',
    items: [
      {
        title: '弯头吸管杯与易消化能量补给',
        category: '妈妈用品',
        quantity: 1,
        defaultRole: 'partner',
        notes: '卧床饮水方便；能量补给（如巧克力、运动饮料或面包）请先确认产房与麻醉禁食水要求。',
      },
      {
        title: '产褥护理垫与安心裤/计量型卫生巾',
        category: '妈妈用品',
        quantity: 2,
        defaultRole: 'mother',
        notes:
          '用于产程观察及产后早期恶露护理；部分医院要求使用计量型垫巾评估产后出血量，以医嘱为准。',
      },
      {
        title: '前开扣纯棉住院服、防滑拖鞋与保暖袜',
        category: '妈妈用品',
        quantity: 2,
        defaultRole: 'mother',
        notes:
          '前开扣便于胎心监护、产后查体及早接触哺乳；拖鞋务必选择包跟防滑底，预防产后体位性头晕跌倒。',
      },
      {
        title: '会阴冲洗瓶与个人洗漱护肤品',
        category: '妈妈用品',
        quantity: 1,
        defaultRole: 'mother',
        notes:
          '产后如厕后使用温水清洁会阴保持干爽；洗漱用品选无香温和型，无需准备未经循证验证的草药洗液。',
      },
    ],
  },
  {
    id: 'newborn-essentials',
    title: '新生儿住院与出院包',
    summary: '贴身换洗、尿布清洁与安全乘车出院准备',
    items: [
      {
        title: 'NB 码纸尿裤与纯水婴儿棉柔巾/湿巾',
        category: '宝宝用品',
        quantity: 1,
        defaultRole: 'partner',
        notes: '准备住院 3–5 天用量即可，便于观察新生儿大小便次数与胎便转黄情况。',
      },
      {
        title: 'A 类纯棉和尚服/连体衣与薄包单',
        category: '宝宝用品',
        quantity: 2,
        defaultRole: 'mother',
        notes: '提前剪除线头与内侧标签并清洗晾晒；按医院室温增减，遵循科学适度保暖，切勿过度捂热。',
      },
      {
        title: '婴儿护臀膏与 75% 医用酒精/碘伏棉签',
        category: '宝宝用品',
        quantity: 1,
        defaultRole: 'mother',
        notes: '脐带日常保持清洁干燥即可，具体消毒方式遵循出院时新生儿科/产科护士指导。',
      },
      {
        title: '反向安装的 0+ 组婴儿安全提篮/安全座椅',
        category: '宝宝用品',
        quantity: 1,
        defaultRole: 'partner',
        notes: '自驾出院前提前在车内完成反向安装练习，切勿怀抱新生儿乘车。',
      },
    ],
  },
  {
    id: 'companion-logistics',
    title: '陪护与应急后勤包',
    summary: '夜间陪护、长线充电器与就医交通应急准备',
    items: [
      {
        title: '2 米长线手机充电器与大容量充电宝',
        category: '陪护后勤',
        quantity: 1,
        defaultRole: 'partner',
        notes: '病房床头插座通常较远，长线便于卧床记录宫缩、联系家属与随时展码缴费。',
      },
      {
        title: '陪护人换洗衣物、洗漱袋与薄毯/颈枕',
        category: '陪护后勤',
        quantity: 1,
        defaultRole: 'partner',
        notes: '提前向医院确认陪护人数规定、陪护床租借时间及进出病区门禁要求。',
      },
      {
        title: '少量备用零钱、纸巾湿巾与收纳垃圾袋',
        category: '陪护后勤',
        quantity: 1,
        defaultRole: 'partner',
        notes: '应对急诊押金、自助机或信号不佳场景，分装袋便于区分洁净衣物与待洗衣物。',
      },
    ],
  },
];
