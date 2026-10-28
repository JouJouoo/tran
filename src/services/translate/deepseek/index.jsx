import { Language } from './info';

export const API_URL = 'https://api.deepseek.com/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;

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

const MAX_INLINE_IMAGE_BASE64_LENGTH = Math.ceil((32 * 1024 * 1024) / 3) * 4;

function getMessages(text, from, to, promptList = DEFAULT_PROMPT_LIST) {
    return promptList.map((item) => ({
        role: item.role,
        content: item.content.replaceAll('$text', text).replaceAll('$from', from).replaceAll('$to', to),
    }));
}

function getErrorMessage(response, data) {
    const message =
        (typeof data === 'string' && data.trim() ? data : null) ||
        data?.error?.message ||
        data?.message ||
        data?.error ||
        `DeepSeek request failed (${response.status})`;
    return new Error(String(message));
}

function parseResponseBody(body) {
    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
}

async function readStream(response, setResult) {
    if (!response.body) {
        throw 'DeepSeek returned an empty response';
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let target = '';
    let streamDone = false;

    const consumeEvent = (event) => {
        for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') return true;
            if (!payload) continue;

            const data = JSON.parse(payload);
            if (data.error) {
                throw getErrorMessage(response, data);
            }
            const content = data.choices?.[0]?.delta?.content ?? '';
            if (content) {
                target += content;
                setResult?.(target);
            }
        }
        return false;
    };

    try {
        while (!streamDone) {
            const { done, value } = await reader.read();
            if (done) {
                streamDone = true;
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() ?? '';

            for (const event of events) {
                if (consumeEvent(event)) {
                    streamDone = true;
                    break;
                }
            }
        }

        if (buffer.trim()) {
            consumeEvent(buffer);
        }
    } finally {
        if (streamDone) reader.cancel().catch(() => {});
        reader.releaseLock();
    }

    return target.trim();
}

export async function request(text, options = {}) {
    const {
        config = {},
        from = Language.auto,
        to = Language.en,
        setResult,
        promptList: customPromptList,
        imageBase64,
        stream = true,
        timeoutMs = REQUEST_TIMEOUT_MS,
    } = options;
    const promptList = customPromptList ?? (config.promptList?.length ? config.promptList : DEFAULT_PROMPT_LIST);
    const body = {
        // DeepSeek's visual input is currently supported by deepseek-flash.
        model: imageBase64 ? 'deepseek-flash' : config.model || 'deepseek-flash',
        messages: getMessages(text, from, to, promptList),
        stream,
        max_tokens: Number(config.maxTokens ?? DEFAULT_REQUEST_ARGUMENTS.maxTokens),
        top_p: Number(config.topP ?? DEFAULT_REQUEST_ARGUMENTS.topP),
    };

    if (imageBase64) {
        const userMessage = [...body.messages].reverse().find((message) => message.role === 'user');
        if (!userMessage) {
            throw new Error('DeepSeek image translation requires a user prompt');
        }
        userMessage.content = [
            { type: 'text', text: userMessage.content },
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                    detail: 'original',
                },
            },
        ];
    }

    // DeepSeek enables thinking by default. Set it explicitly so the switch in
    // this app controls the API behavior instead of silently using that default.
    body.thinking = { type: config.thinking ? 'enabled' : 'disabled' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await window.fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey ?? ''}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || (stream && !contentType.includes('text/event-stream'))) {
            const data = parseResponseBody(await response.text());
            if (!response.ok || data?.error || data?.message) {
                throw getErrorMessage(response, data);
            }
            const content = data?.choices?.[0]?.message?.content;
            if (typeof content === 'string' && content.trim()) return content.trim();
            throw getErrorMessage(response, data);
        }

        if (stream) return await readStream(response, setResult);

        const data = await response.json();
        if (data.error) {
            throw getErrorMessage(response, data);
        }
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
            throw new Error(`DeepSeek returned no translation: ${JSON.stringify(data)}`);
        }
        return content.trim();
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`DeepSeek request timed out after ${Math.ceil(timeoutMs / 1000)} seconds`);
        }
        if (error instanceof TypeError && /fetch/i.test(error.message)) {
            throw new Error('DeepSeek connection failed. Check network access, API key, and firewall settings.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export async function translate(text, from, to, options = {}) {
    return request(text, { ...options, from, to });
}

export async function translateImage(imageBase64, from, to, options = {}) {
    if (!imageBase64) {
        throw new Error('Screenshot image is empty');
    }
    if (imageBase64.length > MAX_INLINE_IMAGE_BASE64_LENGTH) {
        throw new Error('Screenshot is too large for DeepSeek vision; select a smaller area and try again');
    }
    return request('', { ...options, imageBase64, from, to, stream: false });
}

export async function translateNaming(text, format, options = {}) {
    const promptList = [
        {
            role: 'system',
            content:
                'You create concise English file and folder names from Chinese input. Do not translate long input word for word: identify its main subject or purpose and summarize it into a short name. Aim for 2–5 English words and use at most 6; never return a full sentence. Preserve the key meaning, remove filler and details that do not help identify the name. Return only the name, without quotes, explanations, punctuation, file extensions, or naming separators.',
        },
        {
            role: 'user',
            content: `Summarize this Chinese text as a concise English ${format} file or folder name:\n"""\n$text\n"""`,
        },
    ];
    return request(text, {
        ...options,
        config: { ...options.config, maxTokens: 64 },
        from: Language.zh_cn,
        to: Language.en,
        promptList,
    });
}

export * from './Config';
export * from './info';
