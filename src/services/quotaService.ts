const QUOTA_KEY = 'chat_quota_usage';
const MAX_QUOTA = 30; // 每個學生的每日額度

interface QuotaData {
  count: number;
  lastReset: string; // ISO date string
}

export const quotaService = {
  getUsage(): number {
    const data = localStorage.getItem(QUOTA_KEY);
    if (!data) return 0;
    
    try {
      const parsed: QuotaData = JSON.parse(data);
      const now = new Date();
      const lastReset = new Date(parsed.lastReset);
      
      // 檢查是否是新的一天
      if (now.toDateString() !== lastReset.toDateString()) {
        this.resetQuota();
        return 0;
      }
      
      return parsed.count;
    } catch (e) {
      this.resetQuota();
      return 0;
    }
  },

  incrementUsage() {
    const currentUsage = this.getUsage();
    const data: QuotaData = {
      count: currentUsage + 1,
      lastReset: new Date().toISOString()
    };
    localStorage.setItem(QUOTA_KEY, JSON.stringify(data));
  },

  resetQuota() {
    const data: QuotaData = {
      count: 0,
      lastReset: new Date().toISOString()
    };
    localStorage.setItem(QUOTA_KEY, JSON.stringify(data));
  },

  hasQuota(): boolean {
    // 偵錯模式：暫時註解掉限制，始終允許訪問
    // return this.getUsage() < MAX_QUOTA;
    return true;
  },

  getMaxQuota(): number {
    return MAX_QUOTA;
  },

  getRemainingQuota(): number {
    return Math.max(0, MAX_QUOTA - this.getUsage());
  }
};
