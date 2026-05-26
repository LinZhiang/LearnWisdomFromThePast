import { ref } from 'vue'
import type { RankTier } from './rank-data'
import { RANK_LIST } from './rank-data'

export const rankList = ref<RankTier[]>([...RANK_LIST])

type Player = {
  name: string
  wenScore: number
  wuScore: number
  wenTitle: string
  wuTitle: string
  isSelf?: boolean
  isFixed?: boolean
}

export const fixedPlayers: Array<Pick<Player, 'name' | 'wenScore' | 'wuScore'>> = [
  { name: '刘恒', wenScore: 100000, wuScore: 50000 },
  { name: '刘彻', wenScore: 50000, wuScore: 100000 },
  { name: '诸葛亮', wenScore: 48000, wuScore: 42000 },
  { name: '姜维', wenScore: 27000, wuScore: 41000 },
  { name: '钟繇', wenScore: 39000, wuScore: 27000 },
  { name: '华歆', wenScore: 36000, wuScore: 21000 },
  { name: '王朗', wenScore: 35000, wuScore: 20000 },
  { name: '甘宁', wenScore: 7000, wuScore: 11000 },
  { name: '赵云', wenScore: 10000, wuScore: 20000 },
  { name: '关羽', wenScore: 11000, wuScore: 23900 },
  { name: '马超', wenScore: 10500, wuScore: 23700 },
  { name: '陆逊', wenScore: 45000, wuScore: 45000 },
  { name: '孔融', wenScore: 24000, wuScore: 5000 },
  { name: '许褚', wenScore: 1500, wuScore: 10000 },
  { name: '朱治', wenScore: 8900, wuScore: 10000 },
  { name: '法正', wenScore: 19000, wuScore: 11000 },
]

export const moneyList = ref([{
  name: '玩游戏半小时',
  money: -20
}, {
  name: '躺床上看视频一小时（课余学习类视频除外）',
  money: -20
}, {
  name: '一天消费金额超出10元',
  money: -10
}, {
  name: '一星期没有大扫除',
  money: -50
}, {
  name: '三天没有洗澡/倒一次垃圾',
  money: -30
}, {
  name: '买一瓶饮料（不包括牛奶）',
  money: -10
}, {
  name: '买一瓶奶茶/一次烧烤',
  money: -20
}, {
  name: '看h躺30分钟',
  money: -50
}, {
  name: '（离职后开始算）晚上12点前必须上床睡觉，早上8点30前必须起床，中午睡觉时间不能超过一小时，否则扣除50元',
  money: -50
}, {
  name: '轻度运动30分钟',
  money: 5
}, {
  name: '中度运动30分钟',
  money: 10
}, {
  name: '剧烈运动30分钟',
  money: 20
}, {
  name: '做饭/洗碗30分钟',
  money: 10
}, {
  name: '洗漱卫生',
  money: 10
}, {
  name: '洗澡',
  money: 10
}, {
  name: '周六/日补贴',
  money: 30
}])

/** standard：固定第 10 张 2 级+；ladder：按当日第几次提升保底 */
export type CardTicketKind = 'standard' | 'ladder'

export const cardList = ref([{
  kind: 'standard' as CardTicketKind,
  name: '普通抽奖券',
  money: 20,
  timeLimit: 3, //每天最多抽奖次数
  description: '普通抽奖券，每天最多抽奖3次，每次抽10张卡，每次抽奖消耗20块钱，最后一次必中2级或以上的卡',
  rank: [{
    name: '1级普通卡',
    rank: 1,
    money: 1,
    percent: 90,
  }, {
    name: '2级普通卡',
    rank: 2,
    money: 5,
    percent: 8,
  }, {
    name: '3级豪华卡',
    rank: 3,
    money: 15,
    percent: 1.5,
  }, {
    name: '4级超级卡',
    rank: 4,
    money: 50,
    percent: 0.5,
  }, ]
}, {
  kind: 'standard' as CardTicketKind,
  name: '豪华抽奖券',
  money: 50,
  timeLimit: 1, //每天最多抽奖次数
  description: '豪华抽奖券，每天最多抽奖1次，每次抽10张卡，每次抽奖消耗50块钱，最后一次必中2级或以上的卡',
  rank: [{
    name: '1级普通卡',
    rank: 1,
    money: 1,
    percent: 70,
  }, {
    name: '2级普通卡',
    rank: 2,
    money: 5,
    percent: 22,
  }, {
    name: '3级豪华卡',
    rank: 3,
    money: 15,
    percent: 6,
  }, {
    name: '4级超级卡',
    rank: 4,
    money: 50,
    percent: 2,
  }, ]
}, {
  kind: 'ladder' as CardTicketKind,
  name: '阶梯抽奖券',
  money: 30,
  timeLimit: 4,
  description:
    '阶梯抽奖券：每天最多抽奖 4 次，每次抽 10 张卡，每次消耗 30 元。' +
    '第 1～2 次十连抽的第 10 张必为 2 级或以上；第 3 次第 10 张必为 3 级或以上；第 4 次第 10 张必为 4 级。' +
    '次日重置抽奖次数与保底规则。',
  rank: [{
    name: '1级普通卡',
    rank: 1,
    money: 1,
    percent: 85,
  }, {
    name: '2级普通卡',
    rank: 2,
    money: 5,
    percent: 10,
  }, {
    name: '3级豪华卡',
    rank: 3,
    money: 15,
    percent: 4,
  }, {
    name: '4级超级卡',
    rank: 4,
    money: 50,
    percent: 1,
  }, ]
}])

export const moneyRule = ref(`
目前消费金额规则：
1、每天消费金额不超过50元，如果超出需支付额外费用（不包括学习费用）。
2、每天在这个系统学习1小时，或工作2小时，奖励10元额度。
3、每天23点以后到明天早上9点，不再涉及金额结算。
4、每当第一次升级文/武品阶，奖励20元~100元额度（根据人均排名决定奖励金额，并在网页上给一个提示信息，后续升级到相同品阶不再奖励）。
5、默认每天的游戏时间是半小时，每天的视频观看时间也是1小时
6、背景音乐播放时计时，每满 1 小时扣除 3 元；余额不足 3 元时无法开始播放
7、自5月26日离职之日算起，中午睡觉时间不能超过一小时，晚上12点前必须上床睡觉，早上8点30前必须起床，否则扣除50元`);