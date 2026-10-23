// ─── Voice receptionist engine (Oct 8 2026) ─────────────────────────────────────
// Honest-degradation AI phone answering. Three states, never a dead end:
//   - provider_setup_required: no Twilio env → webhooks fail closed (403)
//   - voicemail_only: Twilio configured but no LLM (or plan/owner chose
//     voicemail) → greeting + voicemail recording, still a complete experience
//   - ai_ready: LLM configured + Pro plan + agentMode "ai" → conversational
//     receptionist that answers questions and captures leads.
// $0 fixed cost: reuses the deployment's Twilio credentials and any
// OpenAI-compatible LLM the deployment already runs (including self-hosted).

import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";
import { invokeLLM } from "./llm";

export const VOICE_MAX_TURNS = 6;

export type VoiceLanguage = "en" | "es" | "fr" | "zh" | "yue" | "fil" | "vi" | "ar" | "ko" | "pa";

/** The 10 most-spoken languages in TrueAxis HQ's North American market
 *  (owner is CA; product sells into US+Canada SMBs). Ranking merges US Census
 *  ACS (top spoken-at-home: Spanish, Chinese, Tagalog, Vietnamese, Arabic,
 *  French, Korean) with StatCan 2021 (Mandarin, Cantonese, Punjabi, Tagalog,
 *  Arabic). Every code below is verified in Twilio's own SDK type unions
 *  (twilio-node 5.13.1: GatherLanguage for STT, SayVoice/SayLanguage for TTS)
 *  — an unsupported pair would break live calls, so the registry test pins
 *  these exact strings against those unions.
 *
 *  STT: <Gather language>. TTS: <Say voice + language>. "en" keeps the bare
 *  default <Say> voice (no named voice, no per-character TTS cost); every
 *  other language requires a named voice to be spoken correctly — the
 *  default engine is English-only, so omitting it garbles non-English text
 *  (this was a live bug for the shipped es flow: STT was es-MX but <Say>
 *  still used the English default voice).
 *  TTS voices cost per character used — usage-based, $0 fixed cost holds. */
export const VOICE_LANGUAGES: {
  code: VoiceLanguage;
  englishName: string;
  nativeName: string;
  gatherLocale: string;
  sayVoice: string | null; // null = Twilio default engine (English)
  sayLanguage: string;
  llmName: string;
  digitWords: string[]; // spoken digit words 1..9 for the language menu
  menuEntry: string; // "{d}" is replaced by the spoken digit word
}[] = [
  { code: "en", englishName: "English", nativeName: "English", gatherLocale: "en-US", sayVoice: null, sayLanguage: "en-US", llmName: "English", digitWords: ["one","two","three","four","five","six","seven","eight","nine"], menuEntry: "For English, press {d}." },
  { code: "es", englishName: "Spanish", nativeName: "Español", gatherLocale: "es-MX", sayVoice: "Polly.Mia", sayLanguage: "es-MX", llmName: "Spanish (español)", digitWords: ["uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve"], menuEntry: "Para español, oprima {d}." },
  { code: "fr", englishName: "French", nativeName: "Français", gatherLocale: "fr-CA", sayVoice: "Polly.Chantal", sayLanguage: "fr-CA", llmName: "French (français)", digitWords: ["un","deux","trois","quatre","cinq","six","sept","huit","neuf"], menuEntry: "Pour le français, appuyez sur {d}." },
  { code: "zh", englishName: "Chinese (Mandarin)", nativeName: "普通话", gatherLocale: "cmn-Hans-CN", sayVoice: "Polly.Zhiyu", sayLanguage: "zh-CN", llmName: "Mandarin Chinese (普通话)", digitWords: ["一","二","三","四","五","六","七","八","九"], menuEntry: "普通话请按{d}。" },
  { code: "yue", englishName: "Chinese (Cantonese)", nativeName: "廣東話", gatherLocale: "yue-Hant-HK", sayVoice: "Google.yue-HK-Standard-A", sayLanguage: "yue-HK", llmName: "Cantonese (廣東話)", digitWords: ["一","二","三","四","五","六","七","八","九"], menuEntry: "廣東話請㩒{d}。" },
  { code: "fil", englishName: "Tagalog", nativeName: "Tagalog", gatherLocale: "fil-PH", sayVoice: "Google.fil-PH-Standard-A", sayLanguage: "fil-PH", llmName: "Tagalog", digitWords: ["isa","dalawa","tatlo","apat","lima","anim","pito","walo","siyam"], menuEntry: "Para sa Tagalog, pindutin ang {d}." },
  { code: "vi", englishName: "Vietnamese", nativeName: "Tiếng Việt", gatherLocale: "vi-VN", sayVoice: "Google.vi-VN-Standard-A", sayLanguage: "vi-VN", llmName: "Vietnamese (tiếng Việt)", digitWords: ["một","hai","ba","bốn","năm","sáu","bảy","tám","chín"], menuEntry: "Cho tiếng Việt, hãy bấm {d}." },
  { code: "ar", englishName: "Arabic", nativeName: "العربية", gatherLocale: "ar-SA", sayVoice: "Google.ar-XA-Standard-A", sayLanguage: "ar-XA", llmName: "Arabic (العربية, Modern Standard)", digitWords: ["واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة"], menuEntry: "للعربية اضغط {d}." },
  { code: "ko", englishName: "Korean", nativeName: "한국어", gatherLocale: "ko-KR", sayVoice: "Polly.Seoyeon", sayLanguage: "ko-KR", llmName: "Korean (한국어)", digitWords: ["일","이","삼","사","오","육","칠","팔","구"], menuEntry: "한국어는 {d}번을 누르세요." },
  { code: "pa", englishName: "Punjabi", nativeName: "ਪੰਜਾਬੀ", gatherLocale: "pa-guru-IN", sayVoice: "Google.pa-IN-Standard-A", sayLanguage: "pa-IN", llmName: "Punjabi (ਪੰਜਾਬੀ)", digitWords: ["ਇੱਕ","ਦੋ","ਤਿੰਨ","ਚਾਰ","ਪੰਜ","ਛੇ","ਸੱਤ","ਅੱਠ","ਨੌਂ"], menuEntry: "ਪੰਜਾਬੀ ਲਈ {d} ਦਬਾਓ।" },
];

const LANGUAGE_CODES = new Set<string>(VOICE_LANGUAGES.map(l => l.code));
export function normalizeVoiceLanguage(value: string | null | undefined): VoiceLanguage {
  return value && LANGUAGE_CODES.has(value) ? (value as VoiceLanguage) : "en";
}

export function voiceLanguageMeta(code: VoiceLanguage) {
  return VOICE_LANGUAGES.find(l => l.code === code) ?? VOICE_LANGUAGES[0];
}

/** Digits 1-9 select among the languages OTHER than `active` (a caller who
 *  pressed 9 for the menu wants a different language than the one playing).
 *  Digit 0 stays reserved for the human transfer everywhere. Returns entries
 *  in registry order with their assigned digit, for rendering the menu AND
 *  for resolving a pressed digit back to a language on the selection webhook
 *  (the two sides must agree — a contract test pins that). */
export function languageMenuChoices(active: VoiceLanguage): { language: VoiceLanguage; digit: number }[] {
  return VOICE_LANGUAGES.filter(l => l.code !== active).map((l, i) => ({ language: l.code, digit: i + 1 }));
}

// Default greetings disclose the AI upfront (research verdict: homeowners
// accept AI that discloses; >80% hang up on voicemail — ai-receptionist-landscape-2026.md).
export const VOICE_DEFAULT_GREETINGS: Record<VoiceLanguage, string> = {
  en: "Thanks for calling! You've reached our virtual receptionist — I'm an AI assistant, and I'm here to help. How can I help you today?",
  es: "Gracias por llamar. Ha llegado a nuestra recepcionista virtual, un asistente de inteligencia artificial. ¿En qué puedo ayudarle?",
  fr: "Merci d'avoir appelé! Vous êtes en communication avec notre réceptionniste virtuelle, une assistante par intelligence artificielle. Comment puis-je vous aider?",
  zh: "感谢来电！您已接通我们的虚拟接待员，这是一位人工智能助手。请问有什么可以帮您？",
  yue: "多謝致電！你已經接通咗我哋嘅虛擬接待員，係一位人工智能助手。請問有咩可以幫到你？",
  fil: "Salamat sa pagtawag! Nakatawag ka sa aming virtual na resepsyonista, isang AI assistant. Paano kita matutulungan?",
  vi: "Cảm ơn bạn đã gọi! Bạn đã kết nối với tổng đài viên ảo của chúng tôi, một trợ lý trí tuệ nhân tạo. Tôi có thể giúp gì cho bạn?",
  ar: "شكراً لاتصالك! لقد تواصلت مع موظفة الاستقبال الافتراضية لدينا، وهي مساعدة بالذكاء الاصطناعي. كيف يمكنني مساعدتك؟",
  ko: "전화해 주셔서 감사합니다! 저희 가상 접수원, 인공지능 어시스턴트에 연결되었습니다. 무엇을 도와드릴까요?",
  pa: "ਸਾਡੇ ਨੂੰ ਫ਼ੋਨ ਕਰਨ ਲਈ ਧੰਨਵਾਦ! ਤੁਸੀਂ ਸਾਡੀ ਵਰਚੁਅਲ ਰਿਸੈਪਸ਼ਨਿਸਟ ਨਾਲ ਜੁੜ ਚੁੱਕੇ ਹੋ, ਜੋ ਇੱਕ AI ਅਸਿਸਟੈਂਟ ਹੈ। ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰਾਂ?",
};
// Back-compat alias for existing imports.
export const VOICE_DEFAULT_GREETING = VOICE_DEFAULT_GREETINGS.en;

/** Every spoken fixed prompt, per language. A missing key is a bug — the
 *  phrase-parity test pins all ten languages to the same key set. */
export const VOICE_PHRASES: Record<VoiceLanguage, Record<string, string>> = {
  en: {
    retry: "Sorry, I did not catch that. Could you say that again? You can also press zero to reach a person.",
    anythingElse: "Is there anything else I can help with?",
    leadSaved: "We have saved your details and will follow up shortly. Goodbye!",
    switchingToVoicemail: "One moment, I am switching to message mode.",
    leaveAMessage: "Let me take a message so the team can follow up.",
    callbackHours: "Please call back during business hours. Goodbye.",
    transferConnecting: "One moment, connecting you with a team member now.",
    transferUnavailable: "No one is available to take your call right now. Let me take a message so someone can follow up.",
    pressZeroHint: "Press zero at any time to reach a person.",
    languageMenuHint: "To continue in another language, press nine.",
    chooseLanguage: "Please choose your language.",
    callBackLater: "The number you have dialed is not accepting calls right now. Please try again later.",
    technicalProblem: "We are having a technical problem right now. Please try again in a few minutes.",
  },
  es: {
    retry: "Lo siento, no le entendí. ¿Podría repetirlo? También puede marcar cero para hablar con una persona.",
    anythingElse: "¿En qué más puedo ayudarle?",
    leadSaved: "Hemos guardado sus datos y le contactaremos pronto. ¡Adiós!",
    switchingToVoicemail: "Un momento, cambio al modo de mensajes.",
    leaveAMessage: "Permítame tomar un mensaje para que el equipo le contacte.",
    callbackHours: "Por favor, llame de nuevo en horario de atención. Adiós.",
    transferConnecting: "Un momento, le comunico con un miembro del equipo.",
    transferUnavailable: "Nadie está disponible para atender su llamada en este momento. Permítame tomar un mensaje para que alguien le contacte.",
    pressZeroHint: "Marque cero en cualquier momento para hablar con una persona.",
    languageMenuHint: "Para continuar en otro idioma, oprima nueve.",
    chooseLanguage: "Por favor, elija su idioma.",
    callBackLater: "El número al que llama no está recibiendo llamadas en este momento. Por favor, intente más tarde.",
    technicalProblem: "Tenemos un problema técnico en este momento. Por favor, intente en unos minutos.",
  },
  fr: {
    retry: "Désolé, je ne vous ai pas bien compris. Pourriez-vous répéter? Vous pouvez aussi composer le zéro pour parler à une personne.",
    anythingElse: "Puis-je vous aider avec autre chose?",
    leadSaved: "Vos coordonnées sont enregistrées et nous vous contacterons bientôt. Au revoir!",
    switchingToVoicemail: "Un instant, je passe au mode message.",
    leaveAMessage: "Permettez-moi de prendre un message pour que l'équipe puisse vous répondre.",
    callbackHours: "Veuillez rappeler pendant les heures d'ouverture. Au revoir.",
    transferConnecting: "Un instant, je vous transfère à un membre de l'équipe.",
    transferUnavailable: "Personne n'est disponible pour prendre votre appel en ce moment. Permettez-moi de prendre un message pour que quelqu'un vous réponde.",
    pressZeroHint: "Composez le zéro en tout temps pour parler à une personne.",
    languageMenuHint: "Pour continuer dans une autre langue, appuyez sur le neuf.",
    chooseLanguage: "Veuillez choisir votre langue.",
    callBackLater: "Le numéro que vous avez composé n'accepte pas les appels en ce moment. Veuillez réessayer plus tard.",
    technicalProblem: "Nous avons un problème technique en ce moment. Veuillez réessayer dans quelques minutes.",
  },
  zh: {
    retry: "抱歉，我没有听清。请您再说一遍好吗？您也可以按零转接人工服务。",
    anythingElse: "请问还有其他需要帮助的吗？",
    leadSaved: "我们已记录您的信息，会尽快与您联系。再见！",
    switchingToVoicemail: "请稍等，正在为您切换到留言模式。",
    leaveAMessage: "请留下您的信息，我们的团队会尽快与您联系。",
    callbackHours: "请在营业时间内再来电。再见。",
    transferConnecting: "请稍等，正在为您转接工作人员。",
    transferUnavailable: "现在没有工作人员可以接听您的电话。请留下信息，我们会尽快回复您。",
    pressZeroHint: "您随时可以按零转接人工服务。",
    languageMenuHint: "如需其他语言服务，请按九。",
    chooseLanguage: "请选择您的语言。",
    callBackLater: "您拨打的号码现在无法接通。请稍后再拨。",
    technicalProblem: "系统目前出现技术故障。请几分钟后再试。",
  },
  yue: {
    retry: "唔好意思，我聽唔清楚。可唔可以再講一次？你亦可以㩒零轉駁人工服務。",
    anythingElse: "仲有冇其他嘢可以幫到你？",
    leadSaved: "我哋已經記低你嘅資料，會盡快聯絡你。再見！",
    switchingToVoicemail: "請稍等，而家幫你轉去留言模式。",
    leaveAMessage: "請留低你嘅信息，我哋嘅團隊會盡快聯絡你。",
    callbackHours: "請喺辦公時間再致電。再見。",
    transferConnecting: "請稍等，而家幫你轉駁工作人員。",
    transferUnavailable: "而家冇工作人員可以接聽你嘅電話。請留低信息，我哋會盡快回覆你。",
    pressZeroHint: "你任何時候都可以㩒零轉駁人工服務。",
    languageMenuHint: "如果需要其他語言，請㩒九。",
    chooseLanguage: "請揀你嘅語言。",
    callBackLater: "你打嚟嘅號碼而家未能接聽。請遲啲再試。",
    technicalProblem: "系統而家有技術故障。請幾分鐘後再試。",
  },
  fil: {
    retry: "Paumanhin, hindi kita narinig nang malinaw. Maaari mo bang ulitin? Maaari mo ring pindutin ang zero para makausap ang tao.",
    anythingElse: "May iba pa ba akong matutulungan?",
    leadSaved: "Na-save na ang iyong impormasyon at makikipag-ugnayan kami sa iyo sa lalong madaling panahon. Paalam!",
    switchingToVoicemail: "Isang sandali, lilipat ako sa mode ng pag-iwan ng mensahe.",
    leaveAMessage: "Pahintulutan akong mag-iwan ng mensahe para maisunod ng aming pangkat.",
    callbackHours: "Mangyaring tumawag muli sa oras ng operasyon. Paalam.",
    transferConnecting: "Isang sandali, ikokonekta kita sa miyembro ng aming pangkat.",
    transferUnavailable: "Walang makakasagot sa iyong tawag sa ngayon. Pahintulutan akong mag-iwan ng mensahe para may makasunod sa iyo.",
    pressZeroHint: "Pindutin ang zero anumang oras para makausap ang tao.",
    languageMenuHint: "Upang magpatuloy sa ibang wika, pindutin ang siyam.",
    chooseLanguage: "Mangyaring piliin ang iyong wika.",
    callBackLater: "Hindi tumatanggap ng mga tawag ang numerong tinawagan mo sa ngayon. Subukan muli mamaya.",
    technicalProblem: "May teknikal na problema kami sa ngayon. Pakisubukan muli sa loob ng ilang minuto.",
  },
  vi: {
    retry: "Xin lỗi, tôi không nghe rõ. Bạn vui lòng nói lại? Bạn cũng có thể bấm số không để gặp nhân viên.",
    anythingElse: "Tôi có thể giúp gì thêm cho bạn?",
    leadSaved: "Chúng tôi đã lưu thông tin của bạn và sẽ liên hệ sớm. Tạm biệt!",
    switchingToVoicemail: "Một lát, tôi chuyển sang chế độ để lại lời nhắn.",
    leaveAMessage: "Cho tôi ghi lại lời nhắn để đội ngũ liên hệ với bạn.",
    callbackHours: "Vui lòng gọi lại trong giờ làm việc. Tạm biệt.",
    transferConnecting: "Một lát, tôi đang kết nối bạn với nhân viên.",
    transferUnavailable: "Hiện không có ai có thể nhận cuộc gọi của bạn. Cho tôi ghi lại lời nhắn để chúng tôi liên hệ với bạn.",
    pressZeroHint: "Bấm số không bất cứ lúc nào để gặp nhân viên.",
    languageMenuHint: "Để tiếp tục bằng ngôn ngữ khác, hãy bấm số chín.",
    chooseLanguage: "Vui lòng chọn ngôn ngữ của bạn.",
    callBackLater: "Số bạn vừa gọi hiện không nhận cuộc gọi. Vui lòng thử lại sau.",
    technicalProblem: "Hệ thống đang gặp sự cố kỹ thuật. Vui lòng thử lại sau vài phút.",
  },
  ar: {
    retry: "عذراً، لم أسمعك بوضوح. هل يمكنك التكرار؟ يمكنك أيضاً الضغط على الصفر للتحدث مع شخص.",
    anythingElse: "هل هناك شيء آخر يمكنني مساعدتك فيه؟",
    leadSaved: "لقد حفظنا بياناتك وسنتواصل معك قريباً. وداعاً!",
    switchingToVoicemail: "لحظة من فضلك، سأحولك إلى وضعية تسجيل الرسائل.",
    leaveAMessage: "اسمح لي بتسجيل رسالة ليتواصل معك فريقنا.",
    callbackHours: "يرجى الاتصال مرة أخرى خلال ساعات العمل. وداعاً.",
    transferConnecting: "لحظة من فضلك، أقوم بتحويلك الآن إلى أحد أعضاء الفريق.",
    transferUnavailable: "لا يوجد أحد متاح للرد على مكالمتك حالياً. اسمح لي بتسجيل رسالة ليتواصل معك أحدهم.",
    pressZeroHint: "اضغط على الصفر في أي وقت للتحدث مع شخص.",
    languageMenuHint: "للمتابعة بلغة أخرى، اضغط على التسعة.",
    chooseLanguage: "يرجى اختيار لغتك.",
    callBackLater: "الرقم الذي اتصلت به لا يستقبل مكالمات حالياً. يرجى المحاولة لاحقاً.",
    technicalProblem: "نعاني من مشكلة تقنية حالياً. يرجى المحاولة بعد دقائق قليلة.",
  },
  ko: {
    retry: "죄송합니다, 잘 듣지 못했어요. 다시 말씀해 주시겠어요? 직원과 통화하려면 0번을 누르실 수도 있습니다.",
    anythingElse: "다른 도움이 필요하신가요?",
    leadSaved: "정보를 저장했으며 곧 연락드리겠습니다. 안녕히 계세요!",
    switchingToVoicemail: "잠시만 기다려 주세요, 메시지 모드로 전환합니다.",
    leaveAMessage: "메시지를 남겨 주시면 팀에서 연락드리겠습니다.",
    callbackHours: "업무 시간에 다시 전화해 주시기 바랍니다. 안녕히 계세요.",
    transferConnecting: "잠시만요, 직원에게 연결해 드리겠습니다.",
    transferUnavailable: "지금 전화를 받을 직원이 없습니다. 메시지를 남겨 주시면 연락드리겠습니다.",
    pressZeroHint: "언제든지 0번을 누르시면 직원과 통화하실 수 있습니다.",
    languageMenuHint: "다른 언어로 계속하려면 9번을 누르세요.",
    chooseLanguage: "언어를 선택해 주세요.",
    callBackLater: "지금 전화를 받을 수 없습니다. 잠시 후 다시 걸어 주세요.",
    technicalProblem: "현재 기술적 문제가 있습니다. 몇 분 후 다시 시도해 주세요.",
  },
  pa: {
    retry: "ਮਾਫ਼ ਕਰਨਾ, ਮੈਂ ਸਾਫ਼ ਨਹੀਂ ਸੁਣਿਆ। ਦੁਬਾਰਾ ਕਹਿ ਸਕਦੇ ਹੋ? ਕਿਸੇ ਵਿਅਕਤੀ ਨਾਲ ਗੱਲ ਕਰਨ ਲਈ ਸਿਫ਼ਰ ਦਬਾ ਸਕਦੇ ਹੋ।",
    anythingElse: "ਹੋਰ ਕਿਸੇ ਚੀਜ਼ ਵਿੱਚ ਮਦਦ ਚਾਹੀਦੀ ਹੈ?",
    leadSaved: "ਅਸੀਂ ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਸੰਭਾਲ ਲਈ ਹੈ ਅਤੇ ਜਲਦੀ ਸੰਪਰਕ ਕਰਾਂਗੇ। ਫ਼ਿਰ ਮਿਲਾਂਗੇ!",
    switchingToVoicemail: "ਇੱਕ ਪਲ, ਮੈਂ ਸੁਨੇਹਾ ਛੱਡਣ ਦੇ ਮੋਡ ਵਿੱਚ ਬਦਲ ਰਿਹਾਂ ਹਾਂ।",
    leaveAMessage: "ਸੁਨੇਹਾ ਛੱਡੋ ਤਾਂ ਜੋ ਸਾਡੀ ਟੀਮ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰ ਸਕੇ।",
    callbackHours: "ਕਿਰਪਾ ਕਰਕੇ ਕੰਮ ਦੇ ਸਮੇਂ ਦੌਰਾਨ ਦੁਬਾਰਾ ਫ਼ੋਨ ਕਰੋ। ਫ਼ਿਰ ਮਿਲਾਂਗੇ।",
    transferConnecting: "ਇੱਕ ਪਲ, ਮੈਂ ਤੁਹਾਨੂੰ ਟੀਮ ਦੇ ਮੈਂਬਰ ਨਾਲ ਜੋੜ ਰਿਹਾਂ ਹਾਂ।",
    transferUnavailable: "ਹੁਣ ਕੋਈ ਤੁਹਾਡਾ ਫ਼ੋਨ ਨਹੀਂ ਲੈ ਸਕਦਾ। ਸੁਨੇਹਾ ਛੱਡੋ ਤਾਂ ਜੋ ਕੋਈ ਤੁਹਾਨੂੰ ਜਵਾਬ ਦੇ ਸਕੇ।",
    pressZeroHint: "ਕਿਸੇ ਵਿਅਕਤੀ ਨਾਲ ਗੱਲ ਕਰਨ ਲਈ ਕਦੇ ਵੀ ਸਿਫ਼ਰ ਦਬਾਓ।",
    languageMenuHint: "ਹੋਰ ਭਾਸ਼ਾ ਵਿੱਚ ਜਾਰੀ ਰੱਖਣ ਲਈ ਨੌਂ ਦਬਾਓ।",
    chooseLanguage: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ।",
    callBackLater: "ਇਹ ਨੰਬਰ ਹੁਣ ਫ਼ੋਨ ਨਹੀਂ ਲੈ ਰਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    technicalProblem: "ਸਾਨੂੰ ਹੁਣ ਤਕਨੀਕੀ ਸਮੱਸਿਆ ਆ ਰਹੀ ਹੈ। ਕੁਝ ਮਿੰਟਾਂ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  },
};
export function phrase(language: VoiceLanguage, key: keyof typeof VOICE_PHRASES.en): string {
  return VOICE_PHRASES[language][key];
}

export type VoiceStatusState = "provider_setup_required" | "voicemail_only" | "ai_ready";

export function getVoiceStatus(): {
  state: VoiceStatusState;
  twilioConfigured: boolean;
  llmConfigured: boolean;
  fromNumber: string | null;
} {
  const twilioConfigured = Boolean(ENV.twilioAccountSid && ENV.twilioAuthToken);
  const llmConfigured = Boolean(ENV.forgeApiKey);
  const state: VoiceStatusState = !twilioConfigured
    ? "provider_setup_required"
    : llmConfigured
      ? "ai_ready"
      : "voicemail_only";
  return { state, twilioConfigured, llmConfigured, fromNumber: twilioConfigured ? ENV.twilioFromNumber : null };
}

// ─── Twilio request authentication ─────────────────────────────────────────────
// Twilio signs every webhook: HMAC-SHA1(authToken, fullUrl + sorted k=v pairs).
// Fail closed: no auth token configured → nothing validates → 403.

export function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map(k => k + (params[k] ?? "")).join("");
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = ENV.twilioAuthToken;
  if (!token || !signature) return false;
  const expected = Buffer.from(computeTwilioSignature(token, url, params));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

// ─── Conversation engine ───────────────────────────────────────────────────────

export type VoiceTurn = { role: "caller" | "agent"; text: string; at: string };

export type AgentDecision = {
  say: string;
  intent: "ask" | "lead_captured" | "info_given" | "handoff" | "end";
  callerName?: string;
  callerPhone?: string;
  serviceRequested?: string;
  preferredTime?: string;
};

const agentSchema = {
  name: "voice_agent_decision",
  schema: {
    type: "object",
    properties: {
      say: { type: "string", description: "What the receptionist speaks next. Under 80 words, warm and professional." },
      intent: { type: "string", enum: ["ask", "lead_captured", "info_given", "handoff", "end"] },
      callerName: { type: "string" },
      callerPhone: { type: "string" },
      serviceRequested: { type: "string" },
      preferredTime: { type: "string" },
    },
    required: ["say", "intent"],
    additionalProperties: false,
  },
} as const;

/** Ask the LLM for the next receptionist move. Throws if the LLM is not
 *  configured (assertApiKey inside invokeLLM) — the caller degrades to
 *  voicemail rather than pretending. */
export async function decideNextTurn(input: {
  greeting: string;
  businessInfo: string;
  turns: VoiceTurn[];
  callerSpeech: string;
  language?: string;
}): Promise<AgentDecision> {
  const language = normalizeVoiceLanguage(input.language);
  const langName = voiceLanguageMeta(language).llmName;
  const system = [
    "You are the AI virtual receptionist for a home-service business. You answer questions,",
    "capture leads (name, phone, service, preferred time), and never invent facts.",
    `Respond ONLY in ${langName}, whatever language the caller uses.`,
    "Business info you may quote: " + (input.businessInfo?.trim() || "(none provided — say you will have the owner follow up)"),
    "GROUNDING RULES (absolute): you have NO access to the schedule, prices, quotes, or",
    "availability. Never state, guess, promise, or invent any price, availability, time slot,",
    "or booking confirmation. If asked about those, say you will pass the request to the team",
    "for exact details, and capture it as a lead instead.",
    "DISCLOSURE RULE: you are honest that you are an AI virtual assistant; if this is your",
    "first reply of the conversation, briefly mention you are a virtual assistant.",
    "Rules: keep replies under 80 words. Set intent=lead_captured once you have name AND",
    "service (phone optional; we already see the caller's number). Set intent=info_given",
    "when you answered a question and there is nothing more to do. Set intent=handoff",
    "only for emergencies or angry callers: say the owner will be texted immediately and offer",
    "to connect them by pressing zero if they need a person.",
    "Set intent=end when the caller says goodbye. Otherwise ask one clear question (intent=ask).",
  ].join(" ");

  const history = input.turns.slice(-8).map(t => `${t.role === "caller" ? "Caller" : "Receptionist"}: ${t.text}`).join("\n");
  const result = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: (history ? history + "\n" : "") + `Caller: ${input.callerSpeech}` },
    ],
    outputSchema: agentSchema,
    maxTokens: 300,
  });
  const raw = result.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
  } catch {
    throw new Error("voice agent: LLM returned unparseable JSON");
  }
  const d = parsed as AgentDecision;
  if (typeof d.say !== "string" || !d.say.trim() || !agentSchema.schema.properties.intent.enum?.includes(d.intent as never)) {
    throw new Error("voice agent: LLM returned invalid decision");
  }
  return { ...d, say: d.say.trim().slice(0, 4000) };
}

/** Extract key facts from a caller's speech for lead dedup/attachment. */
export function sanitizeCallerFact(value: string | undefined, max = 300): string | null {
  const clean = (value ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

export function newCallTranscript(firstCallerSpeech: string): VoiceTurn[] {
  return [{ role: "caller", text: firstCallerSpeech.slice(0, 1000), at: new Date().toISOString() }];
}

export function appendTurn(turns: VoiceTurn[], turn: VoiceTurn): VoiceTurn[] {
  const next = [...turns, turn];
  return next.slice(-24); // bounded transcript, matches the 6-turn × bidirectional cap
}
