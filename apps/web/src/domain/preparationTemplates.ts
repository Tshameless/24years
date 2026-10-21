// Organizational prompts, not a clinical schedule or a mandatory shopping list.
export const packingTemplates = [
  {
    title: '证件与就诊资料袋',
    notes: '按医院清单核对证件、预约信息和既往报告；数量：；负责人：；存放位置：',
  },
  {
    title: '个人洗漱与换洗用品',
    notes: '先核对医院提供的用品，避免重复购买；数量：；负责人：；存放位置：',
  },
  { title: '宝宝出院衣物', notes: '根据天气与医院要求准备；数量：；负责人：；存放位置：' },
  {
    title: '手机充电与交通准备',
    notes: '确认充电设备、接送联系人和就医路线；负责人：；存放位置：',
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
