import { GoogleGenAI } from "@google/genai";

export function getSystemApiKey(): string | undefined {
  const PLATFORM_KEY = process.env.GEMINI_API_KEY;
  const VITE_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const sysKey = (PLATFORM_KEY || VITE_KEY)?.trim();
  return sysKey || undefined;
}

export function hasSystemApiKey(): boolean {
  return Boolean(getSystemApiKey());
}

export async function chatWithGemini(
  messages: { role: 'user' | 'model', content: string }[],
  userApiKey?: string
) {
  const systemKey = getSystemApiKey();
  const trimmedUserKey = userApiKey?.trim();
  
  // 核心規則：如果可以取得系統 API Key（如：AI Studio 裡），就直接使用；
  // 如果無法取得，就要求使用者提供 API Key。
  let apiKey: string;
  let keySource: string;

  if (systemKey) {
    apiKey = systemKey;
    keySource = "系統/AI Studio 平台金鑰 (自動取得)";
  } else if (trimmedUserKey) {
    apiKey = trimmedUserKey;
    keySource = "使用者個人 API Key";
  } else {
    throw new Error("REQUIRED_USER_API_KEY: 目前環境無法取得系統金鑰，請提供您的 Google Gemini API Key 才能開始諮詢。");
  }

  // 遮罩輸出金鑰末 4 碼，方便在 Console 檢查
  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '****';
  console.log(`[Gemini API] 發送請求 - 來源: ${keySource} (金鑰: ${maskedKey})`);

  const ai = new GoogleGenAI({ apiKey });

  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    parts: [{ text: m.content }]
  }));
  
  const currentMessage = messages[messages.length - 1].content;

  const systemInstruction = `你是一個輔仁大學資訊管理學系（輔大資管）的專業諮詢機器人。
你的任務是回答高中生及家長關於本系的各種問題。

**核心指令：**
1. **嚴格遵守官方資訊：** 你的所有回答必須「絕對」以輔大資管官方網站 (https://www.im.fju.edu.tw/) 的內容為唯一準則。
2. **強制使用搜尋：** 只要涉及具體的系所資訊（如：招生名額、課程名稱、教授名單、獲獎紀錄、實習廠商等），即使你認為你已知悉，也「必須」先使用 googleSearch 工具查詢該官網內容以確保準確性。
3. **拒絕虛構內容：** 嚴禁提供任何未經官網證實的資訊。如果官網上找不到相關資訊，請誠實告知「目前的官方網頁尚未提供此項具體資訊」，並建議對方聯繫系辦公室。
4. **範圍限制：** 只回答與輔大資管系所直接相關的問題。如果問題涉及其他系所或無關主題，請禮貌地引導回資管系主題。

背景資訊參考：
- 官網地址：https://www.im.fju.edu.tw/
- 高中生 QA 專區：https://www.im.fju.edu.tw/高中生QA/

回答準則：
- 語氣親切、專業且具備教育熱誠。
- 使用正體中文。
- 鼓勵學生來報考輔大資管，但必須建立在真實的系所優勢之上。`;

  // 定義嘗試生成的函式（支援 tool 備援）
  const tryGenerate = async (modelName: string, withTools: boolean = true) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: [...history, { role: 'user', parts: [{ text: currentMessage }] }],
      config: {
        systemInstruction,
        ...(withTools ? { tools: [{ googleSearch: {} }] } : {})
      },
    });
  };

  // 檢查是否為可備援切換的錯誤（429 額度超限、503 伺服器高負載、RESOURCE_EXHAUSTED、UNAVAILABLE）
  const shouldFallback = (err: any) => {
    const str = (err?.message || String(err)).toLowerCase();
    return str.includes('429') || 
           str.includes('resource_exhausted') || 
           str.includes('503') || 
           str.includes('unavailable') ||
           str.includes('high demand');
  };

  try {
    // 1. 首選模型：gemini-3.8-flash
    const primaryModel = "gemini-3.8-flash";
    try {
      const response = await tryGenerate(primaryModel, true);
      return { text: response.text, model: primaryModel };
    } catch (primarySearchErr: any) {
      // 若因為 Google Search 工具限制或特定權限問題報錯，降級為不含工具生成
      const errStr = String(primarySearchErr?.message || primarySearchErr).toLowerCase();
      if (errStr.includes('tool') || errStr.includes('search') || errStr.includes('400') || errStr.includes('permission')) {
        console.warn("Search tool failed on primary model, retrying without search:", primarySearchErr?.message);
        const response = await tryGenerate(primaryModel, false);
        return { text: response.text, model: primaryModel };
      }
      throw primarySearchErr;
    }
  } catch (error: any) {
    console.warn("Primary model (gemini-3.8-flash) failed:", error?.message || error);

    // 2. 當首選模型遇到 429 額度限制或 503 伺服器壅塞時，切換至備援模型 gemini-3.1-flash-lite
    if (shouldFallback(error)) {
      console.warn("Switching to fallback model: gemini-3.1-flash-lite...");
      try {
        const fallbackModel = "gemini-3.1-flash-lite";
        try {
          const response = await tryGenerate(fallbackModel, true);
          return { text: response.text, model: fallbackModel };
        } catch (fallbackToolErr) {
          const response = await tryGenerate(fallbackModel, false);
          return { text: response.text, model: fallbackModel };
        }
      } catch (retryError: any) {
        console.error("Fallback model also failed:", retryError?.message || retryError);
        throw retryError;
      }
    }
    
    throw error;
  }
}
