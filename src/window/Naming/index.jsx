import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/api/clipboard';
import {
    Button,
    Card,
    CardBody,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Switch,
} from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { MdContentCopy } from 'react-icons/md';

import { useConfig, useToastStyle } from '../../hooks';
import { store } from '../../utils/store';
import { getServiceName } from '../../utils/service_instance';
import { translateNaming } from '../../services/translate/deepseek';
import { osType } from '../../utils/env';

const FORMAT_OPTIONS = ['snake_case', 'camelCase', 'PascalCase', 'kebab-case'];

function splitExtension(value) {
    const match = value.trim().match(/^(.+?)(\.[^./\\]+)$/);
    if (!match || match[1].trim() === '') {
        return { name: value.trim(), extension: '' };
    }
    return { name: match[1].trim(), extension: match[2] };
}

function wordsFromResult(value) {
    return value
        .replace(/```[a-z]*|```/gi, '')
        .replace(/["'“”‘’`]/g, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function upperFirst(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
}

export function formatNamingResult(value, format, extension = '') {
    const words = wordsFromResult(value);
    if (words.length === 0) return extension;

    let result = '';
    switch (format) {
        case 'camelCase':
            result = words[0].toLowerCase() + words.slice(1).map(upperFirst).join('');
            break;
        case 'PascalCase':
            result = words.map(upperFirst).join('');
            break;
        case 'kebab-case':
            result = words.map((word) => word.toLowerCase()).join('-');
            break;
        case 'snake_case':
        default:
            result = words.map((word) => word.toLowerCase()).join('_');
            break;
    }
    return `${result}${extension}`;
}

async function getDeepSeekConfig() {
    const serviceList = (await store.get('translate_service_list')) ?? [];
    const deepSeekKey = serviceList.find((key) => getServiceName(key) === 'deepseek') ?? 'deepseek';
    return (await store.get(deepSeekKey)) ?? null;
}

export default function Naming() {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const [result, setResult] = useState('');
    const [rawResult, setRawResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [format, setFormat] = useConfig('naming_format', 'snake_case');
    const [autoCopy, setAutoCopy] = useConfig('naming_auto_copy', true);
    const toastStyle = useToastStyle();
    const inputRef = useRef(null);

    useEffect(() => {
        if (appWindow.label === 'naming') {
            appWindow.show();
        }

        const unlisten = listen('new_naming_text', (event) => {
            const text = event.payload?.toString?.() ?? '';
            setInput(text);
            setResult('');
            setRawResult('');
            setTimeout(() => inputRef.current?.focus(), 50);
        });
        return () => {
            unlisten.then((dispose) => dispose());
        };
    }, []);

    useEffect(() => {
        if (result && autoCopy) {
            writeText(result).catch(() => {});
        }
    }, [result, autoCopy]);

    const runNamingTranslation = async () => {
        const source = input.trim();
        if (!source) {
            toast.error(t('naming.empty_input'), { style: toastStyle });
            return;
        }

        const config = await getDeepSeekConfig();
        if (!config?.apiKey) {
            toast.error(t('naming.configure_deepseek'), { style: toastStyle });
            return;
        }

        const { name, extension } = splitExtension(source);
        setIsLoading(true);
        setResult('');
        setRawResult('');
        try {
            const translated = await translateNaming(name, format, {
                config,
                setResult: setRawResult,
            });
            setResult(formatNamingResult(translated, format, extension));
        } catch (error) {
            toast.error(error.toString(), { style: toastStyle });
        } finally {
            setIsLoading(false);
        }
    };

    const visibleResult = result || rawResult;
    const isNamingWindow = appWindow.label === 'naming';

    return (
        <div className={`h-full w-full ${isNamingWindow ? 'bg-background p-3' : 'p-1'}`}>
            <Toaster />
            {isNamingWindow && (
                <div
                    className='h-[28px] fixed top-0 left-0 right-0'
                    data-tauri-drag-region='true'
                />
            )}
            <Card className='h-full'>
                <CardBody className='gap-4'>
                    <Input
                        ref={inputRef}
                        label={t('naming.input')}
                        placeholder={t('naming.input_placeholder')}
                        value={input}
                        onValueChange={setInput}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') runNamingTranslation();
                        }}
                        autoFocus
                    />
                    <div className='flex items-center gap-2'>
                        <span className='text-small'>{t('naming.format')}</span>
                        <Dropdown>
                            <DropdownTrigger>
                                <Button variant='bordered'>{format}</Button>
                            </DropdownTrigger>
                            <DropdownMenu
                                aria-label={t('naming.format')}
                                selectedKeys={[format]}
                                selectionMode='single'
                                onAction={(key) => setFormat(key.toString())}
                            >
                                {FORMAT_OPTIONS.map((item) => (
                                    <DropdownItem key={item}>{item}</DropdownItem>
                                ))}
                            </DropdownMenu>
                        </Dropdown>
                        <Switch
                            size='sm'
                            isSelected={Boolean(autoCopy)}
                            onValueChange={setAutoCopy}
                        >
                            {t('naming.auto_copy')}
                        </Switch>
                    </div>
                    <div className='flex gap-2'>
                        <Input
                            className='flex-1'
                            label={t('naming.result')}
                            value={visibleResult}
                            isReadOnly
                        />
                        <Button
                            isIconOnly
                            className='mt-7'
                            variant='flat'
                            isDisabled={!result}
                            onPress={() =>
                                writeText(result).then(() => toast.success(t('naming.copied'), { style: toastStyle }))
                            }
                        >
                            <MdContentCopy />
                        </Button>
                    </div>
                    <Button
                        color='primary'
                        isLoading={isLoading}
                        onPress={runNamingTranslation}
                    >
                        {t('naming.translate')}
                    </Button>
                    {isNamingWindow && osType !== 'Darwin' && (
                        <Button
                            variant='light'
                            onPress={() => appWindow.close()}
                        >
                            {t('common.cancel')}
                        </Button>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
