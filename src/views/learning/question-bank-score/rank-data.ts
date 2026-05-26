export type RankTier = {
  score: number
  rank: number
  wenguan: string
  wuguan: string
  wenExplain?: string
  wuExplain?: string
}

/** 文武品阶阈值表（按 score 升序） */
export const RANK_LIST: RankTier[] = [
  { score: -100000, rank: -3, wenguan: '流民', wuguan: '流民' },
  { score: -300, rank: -2, wenguan: '草寇', wuguan: '草寇' },
  { score: -100, rank: -1, wenguan: '黄巾贼', wuguan: '黄巾贼' },
  { score: 0, rank: 0, wenguan: '平民', wuguan: '平民' },
  {
    score: 100,
    rank: 1,
    wenguan: '邻长',
    wuguan: '士卒',
    wenExplain: `相较于小吏，邻长在某些朝代（如北魏）是国家正式设置的基层职官。“小吏”是一个泛称，而“邻长”是具体职名。
邻长是《周礼》记载的古代基层职官，属地官司徒管辖。其设置规模为“五家则一人”，主要职责包括纠察邻里过失、登记户籍迁移、协助政令执行。”
`,
  },
  {
    score: 500,
    rank: 2,
    wenguan: '里长',
    wuguan: '屯长（百夫长）',
    wenExplain: `秦汉时期纳入郡县乡亭里五级体系，里长为最基层单位长官（如秦汉时期负责一里事务），负责掌管户口、赋役之事，比较类似大陆的社区居委会主任。
班固著《汉书·百官公卿表》叙述县以下的地方职官说：“大率十里一亭，亭有长。十亭一乡，乡有三老，有秩、啬夫、游徼。”`,
    wuExplain: `"屯长"是秦汉时期戍边部队的基层军事指挥官，到了汉朝能管理一百人的兵。
最基本的单位是伍，也就是每五个人设一名伍长；两个伍合并为什，每十个人设一名什长；五什合为一队，两队为一屯。
秦汉时期纯军事化管理，隶属郡县戍防体系，魏晋南北朝时期开始兼管流民安置，出现军屯民屯分化。`,
  },
  {
    score: 1000,
    rank: 3,
    wenguan: '亭长',
    wuguan: '军侯',
    wenExplain: `亭长是中国古代从战国至唐代设置的基层官吏。
战国时期始于边境防御设施，秦代形成制度，规定每十里设一亭，负责治安警卫、旅客管理及基层民事治理，多由退役士兵担任。`,
    wuExplain: `军侯是‌具体的军职，而非爵位‌。在汉代盛行的部曲制下，军队的基础编制单位是“部”，“部”下设“曲”。‌
“军侯”即是一“曲”的最高指挥官‌，因此也常被称为“曲侯”或“曲长”。‌‌
`,
  },
  {
    score: 2000,
    rank: 4,
    wenguan: '乡长',
    wuguan: '军司马',
    wenExplain: `汉承秦制，县以下设乡、里，乡设三老掌教化，啬夫职听讼、收赋税。
班固著《汉书·百官公卿表》叙述县以下的地方职官说：“大率十里一亭，亭有长。十亭一乡，乡有三老，有秩、啬夫、游徼。”`,
    wuExplain: `汉代大将军营实行五部制军事编制，每部标准配置为校尉（秩比二千石）与军司马（秩比千石）各一人。
在汉代至三国时期的军事体系中，军司马统领一部（千人），是重要的中层指挥官，类似现在的营长。
未设校尉的独立作战单位，则由军司马单独统领部队。`,
  },
  {
    score: 3000,
    rank: 5,
    wenguan: '县丞',
    wuguan: '都尉',
    wenExplain: `县尉是中国古代县级行政机构中主管治安的官职，始置于秦代，与县丞同为县令佐官，掌缉捕盗贼等事务。
汉代延续秦制，大县设左右二尉，小县设一尉，西汉长安与东汉洛阳各设四尉。`,
    wuExplain: `东汉时期不同职务都尉掌管兵马数目不一，除了临时性都尉外，一般的都尉通常掌管一千~三千人之间。`,
  },
  {
    score: 4000,
    rank: 6,
    wenguan: '县令',
    wuguan: '校尉',
    wuExplain: `东汉建立后，对西汉的军制进行了调整。北军八校尉被精简为‌五校尉‌（屯骑、越骑、步兵、长水、射声），主要负责宫廷宿卫。
汉代校尉的常规兵力在2000人左右，这数字背后是精密的军事数学。按《汉书》记载，最基础的作战单位遵循“五进制”：五什为队（50人），五屯为曲（500人），二曲为部（1000人）。校尉统领二部，恰成2000人战术兵团。`,
  },
  {
    score: 5000,
    rank: 7,
    wenguan: '议郎',
    wuguan: '中郎将',
    wenExplain: `议郎（yì láng）是中国古代官名，始设于秦代，西汉沿置，隶属光禄勋，汉秩比六百石（与中郎相同，高于侍郎、郎中），
东汉时提升至六百石。其职责为顾问应对，不参与常规轮值宿卫，属郎官中特殊职类，主要负责规谏讽谕、辅佐治理，相当于皇帝的参政议政近臣。`,
    wuExplain: `东汉以后，中郎将的名号被各割据势力广泛加于武官，不再限于禁卫统领等职，成为了一个大致介于将军和校尉之间的阶层，其职位、品秩、权力差异很大，统兵将领亦多用此名，其上再加称号，如使匈奴中郎将、北中郎将等。`,
  },
  {
    score: 6500,
    rank: 8,
    wenguan: '太守',
    wuguan: '偏将军',
    wuExplain: `偏将军是中国古代武将官名，始设于春秋时期，位列将军副职，多由校尉或裨将升任。三国时期魏国将其定为五品常设官职，属低级军衔，位于裨将军之上、杂号将军之下，可统领三千至五千兵力，由帝王或大将军任命且无固定员额`,
  },
  { score: 9000, rank: 9, wenguan: '州刺史', wuguan: '杂号将军' },
  { score: 12000, rank: 10, wenguan: '尚书', wuguan: '四平将军' },
  { score: 15000, rank: 11, wenguan: '尚书仆射', wuguan: '四安将军' },
  {
    score: 18000,
    rank: 12,
    wenguan: '尚书令',
    wuguan: '四镇将军',
    wenExplain:
      '从‌名义秩级‌看，九卿（中二千石）高于尚书令（千石）；但从‌实际权力与政治地位‌看，东汉以后的尚书令已凌驾于九卿之上，成为事实上的行政首脑。‌',
  },
  { score: 20000, rank: 13, wenguan: '宗正/治粟内史/少府‌', wuguan: '四征将军' },
  { score: 23000, rank: 13, wenguan: '宗正/治粟内史/少府‌', wuguan: '前/后/左/右将军' },
  { score: 24000, rank: 14, wenguan: '宗正/治粟内史/少府‌', wuguan: '卫将军' },
  { score: 27000, rank: 15, wenguan: '卫尉/郎中令/奉常', wuguan: '车骑将军' },
  { score: 32000, rank: 16, wenguan: '三公', wuguan: '骠骑将军' },
  { score: 40000, rank: 17, wenguan: '丞相', wuguan: '大将军' },
  { score: 50000, rank: 18, wenguan: '太傅', wuguan: '大司马' },
  { score: 100000, rank: 19, wenguan: '文帝', wuguan: '武帝' },
]

/** 根据累计分数解析当前文职品阶档位（rank 字段，非名次） */
export function resolveWenRankLevel(score: number): number {
  let level = RANK_LIST[0].rank
  for (const row of RANK_LIST) {
    if (score >= row.score) level = row.rank
  }
  return level
}

/** 根据累计分数解析当前武职品阶档位 */
export function resolveWuRankLevel(score: number): number {
  let level = RANK_LIST[0].rank
  for (const row of RANK_LIST) {
    if (score >= row.score) level = row.rank
  }
  return level
}

export function titleForRankLevel(level: number, axis: 'wen' | 'wu'): string {
  const row = RANK_LIST.find((r) => r.rank === level)
  if (!row) return axis === 'wen' ? RANK_LIST[0].wenguan : RANK_LIST[0].wuguan
  return axis === 'wen' ? row.wenguan : row.wuguan
}

/** 根据累计分数解析当前文职品阶名 */
export function resolveWenTitle(score: number): string {
  return titleForRankLevel(resolveWenRankLevel(score), 'wen')
}

/** 根据累计分数解析当前武职品阶名 */
export function resolveWuTitle(score: number): string {
  return titleForRankLevel(resolveWuRankLevel(score), 'wu')
}
