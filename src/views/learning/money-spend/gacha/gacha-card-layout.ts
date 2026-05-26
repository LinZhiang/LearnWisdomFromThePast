/** 卡面宽高比（宽:高），对齐炽焰天穹式横条卡，略扁于 7:3 */
export const GACHA_CARD_AR_WIDTH = 5
export const GACHA_CARD_AR_HEIGHT = 2

export const gachaCardAspectRatio = `${GACHA_CARD_AR_WIDTH} / ${GACHA_CARD_AR_HEIGHT}` as const

/** 容器查询下按高度反算最大宽度 */
export function gachaCardMaxWidthExpr(captionReserve = '2.5em'): string {
  return `min(100cqw, calc((100cqh - ${captionReserve}) * ${GACHA_CARD_AR_WIDTH} / ${GACHA_CARD_AR_HEIGHT}))`
}
