import { Language } from './info';

export const API_URL = 'https://api.deepseek.com/chat/completions';

export const DEFAULT_PROMPT_LIST = [
    {
        role: 'system',
        content:
            'You are a professional translation engine. Translate only the text content into natural, accurate, fluent language. Do not explain, interpret, summarize, or add anything.',
    },
    {
        role: 'user',
        content: 'Translate into $to:\n"""\n$text\n"""',
    },
];

export const DEFAULT_REQUEST_ARGUMENTS = {
    maxTokens: 2000,
    topP: 0.99,
};

function getMessages(text, from, to, promptList = DEFAULT_PROMPT_LIST) {
    return promptList.map((item) => ({
        role: item.role,
        content: item.content.replaceAll('$text', text).replaceAll('$from', from).replaceAll('$to', to),
    }));
}

function getErrorMessage(response, data) {
    if (typeof data === 'string' && data.trim()) {
        return data;
    }
    return `DeepSeek request failed (${response.status})\n${JSON.stringify(data)}`;
}

async function readStream(response, setResult) {
    if (!response.body) {
        throw 'DeepSeek returned an empty response';
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let target = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() ?? '';

            for (const event of events) {
                for (const line of event.split('\n')) {
                    if (!line.startsWith('data:')) continue;
                    const payload = line.slice(5).trim();
                    if (!payload || payload === '[DONE]') continue;

                    const data = JSON.parse(payload);
                    const content = data.choices?.[0]?.delta?.content ?? '';
                    if (content) {
                        target += content;
                        setResult?.(target);
                    }
                }
            }
        }

        if (buffer.trim()) {
            for (const line of buffer.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                const data = JSON.parse(payload);
                const content = data.choices?.[0]?.delta?.content ?? '';
                if (content) {
                    target += content;
                    setResult?.(target);
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return target.trim();
}

export async function request(text, options = {}) {
    const { config = {}, from = Language.auto, to = Language.en, setResult, promptList: customPromptList } = options;
    const promptList = customPromptList ?? (config.promptList?.length ? config.promptList : DEFAULT_PROMPT_LIST);
    const body = {
        model: config.model || 'deepseek-flash',
        messages: getMessages(text, from, to, promptList),
        stream: true,
        max_tokens: Number(config.maxTokens ?? DEFAULT_REQUEST_ARGUMENTS.maxTokens),
        top_p: Number(config.topP ?? DEFAULT_REQUEST_ARGUMENTS.topP),
    };

    if (config.thinking) {
        body.thinking = { type: 'enabled' };
    }

    const response = await window.fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey ?? ''}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        let data = '';
        try {
            data = await response.text();
        } catch {
            data = '';
        }
        throw getErrorMessage(response, data);
    }

    return readStream(response, setResult);
}

export async function translate(text, from, to, options = {}) {
    return request(text, { ...options, from, to });
}

export async function translateNaming(text, format, options = {}) {
    const promptList = [
        {
            role: 'system',
            content:
                'You translate Chinese names into concise, natural English words for file and folder names. Return English words only. Do not include quotes, explanations, punctuation, file extensions, or naming separators. Keep the meaning clear and practical.',
        },
        {
            role: 'user',
            content: `Translate this Chinese name into English words for a ${format} file or folder name:\n"""\n$text\n"""`,
        },
    ];
    return request(text, { ...options, from: Language.zh_cn, to: Language.en, promptList });
}

export * from './Config';
export * from './info';
