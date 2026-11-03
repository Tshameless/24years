export type GuideTargetTab =
  | 'checkups'
  | 'nutrition'
  | 'vitals'
  | 'ultrasound'
  | 'movements'
  | 'packing'
  | 'birthPlan'
  | 'contractions'
  | 'emergency';

export interface WeeklyActionItem {
  readonly title: string;
  readonly detail: string;
}

export interface WeeklyGuideStage {
  readonly id: string;
  readonly minWeek: number;
  readonly maxWeek: number;
  readonly rangeLabel: string;
  readonly trimester: '孕早期' | '孕中期' | '孕晚期';
  readonly title: string;
  readonly fetalMilestone: string;
  readonly maternalChanges: string;
  readonly checkupFocus: string;
  readonly recommendedTab: GuideTargetTab;
  readonly recommendedTabLabel: string;
  readonly coupleActions: readonly WeeklyActionItem[];
  readonly singleActions: readonly WeeklyActionItem[];
}

// 100% modern evidence-based pregnancy stage guide; clinical schedules defer to hospital advice.
export const weeklyGuideStages: readonly WeeklyGuideStage[] = [
  {
    id: 'w04-06',
    minWeek: 0,
    maxWeek: 6,
    rangeLabel: '孕 4–6 周',
    trimester: '孕早期',
    title: '受精卵着床与神经管发育关键期',
    fetalMilestone:
      '胚胎迅速完成着床，神经管（大脑与脊髓前体）及原始心血管系统开始形成，长度约似芝麻至小扁豆。',
    maternalChanges:
      'HCG 与孕酮水平快速升高，可能出现乳房胀痛、嗜睡乏力或轻度恶心；部分孕妇尚无明显体感变化，均属常见生理现象。',
    checkupFocus:
      '每日规律补充叶酸（常规 0.4–0.8 mg，特殊高危人群遵医嘱），整理既往病史与正在服用的药物清单，预约早孕确认超声（具体周数以医院建议为准）。',
    recommendedTab: 'nutrition',
    recommendedTabLabel: '营养与补剂打卡',
    coupleActions: [
      {
        title: '核对叶酸与居家无烟环境',
        detail: '确认叶酸按时补充，全面杜绝室内二手烟与三手烟暴露，远离酒精及未经医生评估的药物。',
      },
      {
        title: '整理首次早孕就诊问题清单',
        detail: '记录末次月经日期、既往手术/过敏史与日常用药，陪同预约早孕超声核实宫内妊娠。',
      },
    ],
    singleActions: [
      {
        title: '开启每日叶酸固定提醒',
        detail:
          '把叶酸放在水杯旁并设置日常提醒，远离二手烟环境，未经产科医生评估不自行停药或加药。',
      },
      {
        title: '建立就诊资料收纳袋',
        detail: '记录末次月经日期、既往检查单与想咨询医生的问题，按自己的节奏预约早孕门诊。',
      },
    ],
  },
  {
    id: 'w07-10',
    minWeek: 7,
    maxWeek: 10,
    rangeLabel: '孕 7–10 周',
    trimester: '孕早期',
    title: '器官原基分化与早孕反应应对期',
    fetalMilestone:
      '四肢芽体逐渐清晰，心脏分房并稳定搏动，眼耳鼻及主要脏器原基在孕 10 周前后基本成形。',
    maternalChanges:
      '激素峰值易引发晨吐、嗅觉敏感、胃排空减慢或情绪波动；少量多餐、清淡易消化碳水化合物与维生素 B6（遵医嘱）有助缓解恶心。',
    checkupFocus:
      '完成早孕超声核对胚芽与胎心搏动，提前了解意向分娩医院的建档（母子健康手册）时间与所需证件材料。',
    recommendedTab: 'checkups',
    recommendedTabLabel: '产检计划整理',
    coupleActions: [
      {
        title: '主动接管厨房油烟与气味源',
        detail: '承担烹饪、倒垃圾与冰箱清洁，准备苏打饼干、全麦面包或柠檬水应对空腹恶心。',
      },
      {
        title: '电话确认建档材料与流程',
        detail: '提前向社区卫生服务中心及目标产检医院确认建档周数、空腹要求与证件清单。',
      },
    ],
    singleActions: [
      {
        title: '准备床头少量多餐补给',
        detail:
          '备好独立小包装全麦饼干与温水，避开浓烈油烟与刺激气味；若剧烈呕吐无法进水请及时就医。',
      },
      {
        title: '提前查询社区与医院建档流程',
        detail: '利用线上小程序或电话确认母子健康手册办理要求，减少现场往返奔波。',
      },
    ],
  },
  {
    id: 'w11-13',
    minWeek: 11,
    maxWeek: 13,
    rangeLabel: '孕 11–13 周+6',
    trimester: '孕早期',
    title: '正式建档与 NT 超声时间窗',
    fetalMilestone:
      '进入胎儿期，肾脏开始产生少量尿液排入羊水，吞咽与握拳反射萌芽，头臀长快速增长。',
    maternalChanges:
      '部分孕妇早孕恶心逐渐减轻，血容量开始生理性增加；子宫略微超出盆腔，尿频可能有所缓和。',
    checkupFocus:
      '孕 11–13 周+6 是颈项透明层（NT）超声检查的特定窗口期，通常同步完成正式建档及血常规、血型、肝肾功能、甲状腺与感染筛查。',
    recommendedTab: 'ultrasound',
    recommendedTabLabel: 'B 超单数据归档',
    coupleActions: [
      {
        title: '陪同建档抽血并备好早餐',
        detail:
          '建档常需空腹采血，随身带好温水与高蛋白早餐，采血后第一时间补充能量并协助排队缴费。',
      },
      {
        title: '归档首次完整产检与血型信息',
        detail: '将医院电话、病历号与血型录入就医沟通卡，把 NT 报告头臀长与孕周校准信息整理归档。',
      },
    ],
    singleActions: [
      {
        title: '空腹产检随身携带便携早餐',
        detail: '包内备好牛奶、鸡蛋或面包，完成空腹抽血后立即进食，避免低血糖头晕。',
      },
      {
        title: '完善就医沟通卡核心信息',
        detail: '把建档医院急诊电话、病历号及血型填入就医卡，后续复诊随时可查。',
      },
    ],
  },
  {
    id: 'w14-17',
    minWeek: 14,
    maxWeek: 17,
    rangeLabel: '孕 14–17 周',
    trimester: '孕中期',
    title: '精力回升与孕中期遗传学筛查',
    fetalMilestone:
      '骨骼持续骨化，皮肤表面出现细软胎毛，外耳位置上移，听觉结构逐步发育，肢体活动更加协调。',
    maternalChanges:
      '进入相对舒适的孕中期，食欲与体力恢复；受激素影响牙龈毛细血管充血易出血，且铁、钙生理需求量明显上升。',
    checkupFocus:
      '按医嘱沟通并完成中期唐氏筛查、无创 DNA（NIPT）或羊水穿刺评估；开始关注规律体重增长与铁钙分时段补充。',
    recommendedTab: 'vitals',
    recommendedTabLabel: '体重血压趋势',
    coupleActions: [
      {
        title: '建立每周固定时段体重与散步习惯',
        detail: '每周固定晨起空腹记录体重，晚餐后一起散步 20–30 分钟（无运动禁忌前提下）。',
      },
      {
        title: '设置铁剂与钙剂错峰提醒',
        detail: '若医生开具铁剂与钙片，协助安排间隔 2 小时以上服用，避免二价阳离子竞争吸收。',
      },
    ],
    singleActions: [
      {
        title: '保持温和规律身体活动',
        detail:
          '若无产科运动禁忌，每日安排 20–30 分钟平地散步或孕妇伸展，兼顾口腔清洁与软毛牙刷护理。',
      },
      {
        title: '每周记录基础体征变化',
        detail: '固定晨起排空后测量体重并记录，用客观曲线替代每日称重焦虑。',
      },
    ],
  },
  {
    id: 'w18-21',
    minWeek: 18,
    maxWeek: 21,
    rangeLabel: '孕 18–21 周',
    trimester: '孕中期',
    title: '初觉胎动与系统排畸超声预约',
    fetalMilestone:
      '神经肌肉连接进一步成熟，皮下出现胎脂保护皮肤；孕 18–20 周前后多数孕妇开始感知轻柔如气泡或小鱼游动般的初胎动。',
    maternalChanges:
      '重心逐渐前移，圆韧带牵拉可能引起下腹两侧短暂隐痛（变换体位时常见），睡眠时可尝试侧卧并在双腿间垫枕支撑。',
    checkupFocus:
      '确认孕 20–24 周系统超声（大排畸）预约日期；留意胎动初体验，但此时胎动尚不规律，无需计次焦虑。',
    recommendedTab: 'ultrasound',
    recommendedTabLabel: '系统超声记录',
    coupleActions: [
      {
        title: '添置侧卧支撑枕与防滑浴室垫',
        detail: '优化腰背与膝间睡眠支撑，检查浴室防滑措施，减少重心改变带来的跌倒风险。',
      },
      {
        title: '开启晚间安静胎教互动时光',
        detail: '每晚用温和平稳的声音朗读或轻声交谈 10 分钟，重在放松孕妇身心与建立家庭联结。',
      },
    ],
    singleActions: [
      {
        title: '升级睡眠侧卧支撑与居家防滑',
        detail: '在膝盖与腹部垫软枕减轻腰骶压力，浴室铺设稳固防滑垫并穿包跟软底鞋。',
      },
      {
        title: '享受每日 10 分钟舒缓阅读或音乐',
        detail: '选择让自己放松的轻音乐或有声书，妈妈平稳舒展的情绪本身就是最好的孕期陪伴。',
      },
    ],
  },
  {
    id: 'w22-24',
    minWeek: 22,
    maxWeek: 24,
    rangeLabel: '孕 22–24 周',
    trimester: '孕中期',
    title: '系统结构筛查与糖耐量试验前瞻',
    fetalMilestone:
      '肺部支气管树持续分支，内耳前庭系统成熟可感知母体体位变化，睡眠与觉醒周期逐渐交替。',
    maternalChanges:
      '子宫底升至脐平附近，下肢静脉回流压力增大，久坐久站后脚踝易轻度水肿；需注意优质蛋白、膳食纤维与粗细粮搭配。',
    checkupFocus:
      '完成孕中期系统结构超声排查，并提前预约孕 24–28 周 75g 口服葡萄糖耐量试验（OGTT），确认检查前禁食时间要求。',
    recommendedTab: 'nutrition',
    recommendedTabLabel: '循证饮食与控糖参考',
    coupleActions: [
      {
        title: '调整家庭主食结构支持平稳血糖',
        detail: '将部分精白米面替换为燕麦、糙米、杂豆或玉米，先吃蔬菜与优质蛋白、后吃主食。',
      },
      {
        title: '核对 OGTT 空腹要求并全程陪同',
        detail:
          '糖耐量试验需多次定采静脉血（空腹、服糖后 1h、2h），陪同计时看护并准备试验结束后的正餐。',
      },
    ],
    singleActions: [
      {
        title: '提前确认 OGTT 检查前注意事项',
        detail:
          '试验前 3 天保持正常饮食切勿刻意节食（以免影响结果准确性），前一日晚餐后按医院规定时间禁食。',
      },
      {
        title: '久坐时垫高小腿促进静脉回流',
        detail: '办公或休息时每小时起身活动片刻，睡前适度垫高下肢缓解生理性轻度水肿。',
      },
    ],
  },
  {
    id: 'w25-28',
    minWeek: 25,
    maxWeek: 28,
    rangeLabel: '孕 25–28 周',
    trimester: '孕晚期',
    title: '迈入孕晚期与规律胎动观察起点',
    fetalMilestone:
      '肺泡Ⅱ型细胞开始分泌肺表面活性物质，眼睑可睁开感知微弱光亮，皮下脂肪逐步沉积，胎动力量明显增强。',
    maternalChanges:
      '胃部受增大的子宫向上推挤，易出现餐后胃灼热反酸；血容量接近高峰，需预防缺铁性贫血与仰卧位低血压。',
    checkupFocus:
      '复查血常规（评估血红蛋白与铁储备）、尿常规及 OGTT 结果；Rh 阴性血型孕妇需向医生确认抗 D 免疫球蛋白评估安排；孕 28 周起按医嘱开始规律观察胎动。',
    recommendedTab: 'movements',
    recommendedTabLabel: '胎动观察计时',
    coupleActions: [
      {
        title: '协助养成每日固定时段胎动记录',
        detail:
          '每晚安静侧卧时一起静心计时观察胎动，熟悉宝宝日常活跃节律；若明显异于平时及时就医。',
      },
      {
        title: '缓解餐后反酸与腿部抽筋',
        detail:
          '晚餐不过饱、餐后半小时内不平躺；夜间小腿抽筋时协助缓慢背屈脚尖伸展腓肠肌并注意钙与维生素 D 摄入。',
      },
    ],
    singleActions: [
      {
        title: '孕 28 周起建立个人胎动观察习惯',
        detail: '每天选胎儿常活跃的固定时段安静记录，关注与平时相比是否突然明显减少或异常躁动。',
      },
      {
        title: '少量多餐减轻孕晚期胃灼热',
        detail: '避免睡前高脂甜腻饮食，睡眠时可略垫高上半身并采取左侧或右侧舒适卧位。',
      },
    ],
  },
  {
    id: 'w29-32',
    minWeek: 29,
    maxWeek: 32,
    rangeLabel: '孕 29–32 周',
    trimester: '孕晚期',
    title: '每两周规律产检与待产包分批筹备',
    fetalMilestone:
      '大脑皮层沟回迅速丰富，体温调节中枢发育，多数胎儿在此阶段逐步转为头朝下的纵产式（胎位仍可能变化，遵医嘱复查）。',
    maternalChanges:
      '偶发无痛、不规律、休息后缓解的宫缩（Braxton Hicks 假性宫缩）增多；骨盆韧带受松弛素作用可能出现耻骨联合轻度酸胀。',
    checkupFocus:
      '产检频率通常转为每 2 周一次，重点监测血压、尿蛋白、宫高腹围及孕晚期生长发育超声（评估胎儿大小、胎位与羊水）。',
    recommendedTab: 'packing',
    recommendedTabLabel: '待产清单分装',
    coupleActions: [
      {
        title: '按入院证件、妈妈与宝宝分袋整理待产包',
        detail: '优先备齐证件资料袋并确认存放位置，让伴侣清楚每一件物品放在哪个包袋中。',
      },
      {
        title: '密切留心孕晚期血压与水肿信号',
        detail:
          '若出现持续头痛、视物模糊、上腹不适或面部手部突发明显水肿，立即陪同前往医院排查妊娠期高血压疾病。',
      },
    ],
    singleActions: [
      {
        title: '分批导入并核对待产包清单',
        detail:
          '先向建档医院确认住院包提供内容，将身份证、医保凭证与全套产检报告装入随手可拎的透明文件袋。',
      },
      {
        title: '上下床采用侧身支撑法保护耻骨与腰背',
        detail: '翻身及下床时双膝并拢先侧卧再用手臂支撑起身，避免单腿大幅度跨步加重耻骨牵拉。',
      },
    ],
  },
  {
    id: 'w33-36',
    minWeek: 33,
    maxWeek: 36,
    rangeLabel: '孕 33–36 周',
    trimester: '孕晚期',
    title: 'GBS 筛查、胎心监护与分娩意愿沟通',
    fetalMilestone:
      '肺部成熟度持续完善，免疫球蛋白 IgG 通过胎盘主动转运给胎儿提供出生后早期被动免疫，皮下脂肪饱满。',
    maternalChanges:
      '先露部下降（入盆）后呼吸压迫感可能略减轻，但膀胱受压再次引发尿频，夜间睡眠易中断。',
    checkupFocus:
      '孕 35–37 周常规进行 B 族链球菌（GBS）筛查，逐步开展电子胎心监护（NST），并与产检医生讨论分娩镇痛意愿及入院指征。',
    recommendedTab: 'birthPlan',
    recommendedTabLabel: '分娩意愿沟通单',
    coupleActions: [
      {
        title: '共同填写分娩意愿与产后支持分工',
        detail:
          '提前沟通椎管内分娩镇痛（无痛分娩）意愿、陪产政策、早接触早吸吮及出院后夜间照护排班。',
      },
      {
        title: '实地演练早晚高峰去医院路线与急诊入口',
        detail: '确认产科急诊夜间通道、停车位及反向安装的婴儿安全座椅/提篮操作流程。',
      },
    ],
    singleActions: [
      {
        title: '梳理分娩意愿单与紧急协助联系人',
        detail:
          '把分娩镇痛想法、过敏史写入分娩意愿单，并与亲友或专业陪护确认临产接送、住院签字与手续代办衔接。',
      },
      {
        title: '确认医院夜间急诊路线与待产包拎包就走状态',
        detail: '将待产包置于玄关显眼位置，长线充电器与证件袋随包就绪。',
      },
    ],
  },
  {
    id: 'w37-42',
    minWeek: 37,
    maxWeek: 42,
    rangeLabel: '孕 37–40+ 周',
    trimester: '孕晚期',
    title: '足月待产与规律临产信号识别',
    fetalMilestone:
      '孕 37 周起进入足月阶段，各器官系统具备宫外独立适应能力，吸吮、吞咽与呼吸协调成熟，静候自然发动或医嘱适时分娩。',
    maternalChanges:
      '宫颈逐渐成熟软化，可能出现少量果冻状栓塞物伴血丝（见红）；需清晰区分假性宫缩与规律渐强的真临产宫缩。',
    checkupFocus:
      '每周一次产检与胎心监护（NST），综合评估胎位、骨盆条件、胎儿估重与羊水指数；满 40 周未发动时严格按医嘱加密监护。',
    recommendedTab: 'contractions',
    recommendedTabLabel: '宫缩计时与 5-1-1 识别',
    coupleActions: [
      {
        title: '熟记三大入院指征与宫缩计时规则',
        detail:
          '破水（平躺防脐带脱垂立即就医）、达到规律临产宫缩（初产 5-1-1 / 经产 4-1-1）、阴道出血量多如月经或胎动明显异常时立即出发。',
      },
      {
        title: '手机保持 24 小时畅通并预演产后交接',
        detail: '提前确认新生儿出生医学证明办理、疫苗首针登记与产后 42 天复查支持安排。',
      },
    ],
    singleActions: [
      {
        title: '熟记破水、规律宫缩与胎动异常三大信号',
        detail:
          '一旦疑似破水请立即平躺垫高臀部并拨打急救或联系陪同人员前往产科急诊；宫缩规律时用计时器客观记录间隔与时长。',
      },
      {
        title: '保持规律作息与能量储备，从容迎接分娩',
        detail:
          '足月后每天坚持观察胎动与每周产检，把产后喂养与恢复支援清单提前同步给协助亲友或月嫂。',
      },
    ],
  },
];

export function clampGuideWeek(week?: number | null): number {
  if (typeof week !== 'number' || !Number.isFinite(week)) {
    return 12;
  }

  return Math.min(42, Math.max(4, Math.floor(week)));
}

export function getWeeklyGuide(week?: number | null): WeeklyGuideStage {
  const normalized =
    typeof week === 'number' && Number.isFinite(week)
      ? Math.min(42, Math.max(0, Math.floor(week)))
      : 12;

  return (
    weeklyGuideStages.find((stage) => normalized >= stage.minWeek && normalized <= stage.maxWeek) ??
    weeklyGuideStages[weeklyGuideStages.length - 1]!
  );
}
