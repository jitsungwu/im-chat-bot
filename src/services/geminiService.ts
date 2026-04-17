import { GoogleGenAI } from "@google/genai";

export async function chatWithGemini(
  messages: { role: 'user' | 'model', content: string }[],
  userApiKey?: string
) {
  // 恢復最廣泛相容的 API Key 解析邏輯
  const PLATFORM_KEY = process.env.GEMINI_API_KEY;
  const VITE_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  // 目前依照您的要求：除錯模式下優先使用系統/環境變數金鑰，暫不使用 userApiKey
  const apiKey = VITE_KEY || PLATFORM_KEY;
    
  if (!apiKey) {
    throw new Error("Gemini API Key 尚未設定。請在部署環境中設定 VITE_GEMINI_API_KEY 或 GEMINI_API_KEY。");
  }

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

  // 定義嘗試生成的函式
  const tryGenerate = async (modelName: string) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: [...history, { role: 'user', parts: [{ text: currentMessage }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      },
    });
  };

  try {
    // 1. 優先使用 gemini-3.1-flash-lite-preview
    const modelName = "gemini-3.1-flash-lite-preview";
    const response = await tryGenerate(modelName);
    return { text: response.text, model: modelName };
  } catch (error: any) {
    const errorString = error?.message || String(error);
    const isQuotaExceeded = errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED');

    // 2. 有問題或額度滿時，切換到 gemma-4-31b-it
    if (isQuotaExceeded && !userApiKey) {
      console.warn("Primary model limit reached, trying gemma-4-31b-it...");
      try {
        const fallbackModel = "gemma-4-31b-it";
        const response = await tryGenerate(fallbackModel);
        return { text: response.text, model: fallbackModel };
      } catch (retryError) {
        throw retryError;
      }
    }
    
    throw error;
  }
}
