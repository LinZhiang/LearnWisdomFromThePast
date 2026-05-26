/**
 * 界面设置内的金钱相关能力：不因宵禁、余额不足拦截用户操作。
 * 应扣款时若余额足够则正常扣费；不足或扣款异常时静默跳过扣费。
 */
export const SETTINGS_MONEY_UNRESTRICTED = true
