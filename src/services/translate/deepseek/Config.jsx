import {
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Switch,
    Textarea,
} from '@nextui-org/react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { DEFAULT_PROMPT_LIST, DEFAULT_REQUEST_ARGUMENTS, translate } from './index';
import { Language } from './info';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: 'DeepSeek',
            model: 'deepseek-flash',
            apiKey: '',
            thinking: false,
            promptList: DEFAULT_PROMPT_LIST,
            maxTokens: DEFAULT_REQUEST_ARGUMENTS.maxTokens,
            topP: DEFAULT_REQUEST_ARGUMENTS.topP,
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const toastStyle = useToastStyle();

    if (config === null) return null;

    const updatePrompt = (index, content) => {
        setConfig({
            ...config,
            promptList: config.promptList.map((prompt, promptIndex) =>
                promptIndex === index ? { ...prompt, content } : prompt
            ),
        });
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                setIsLoading(true);
                translate('hello', Language.auto, Language.zh_cn, { config })
                    .then(() => {
                        setConfig(config, true);
                        updateServiceList(instanceKey);
                        onClose();
                    })
                    .catch((error) => {
                        toast.error(`${t('config.service.test_failed')}${error}`, { style: toastStyle });
                    })
                    .finally(() => setIsLoading(false));
            }}
        >
            <Toaster />
            <div className='config-item'>
                <Input
                    label={t('services.instance_name')}
                    labelPlacement='outside-left'
                    value={config[INSTANCE_NAME_CONFIG_KEY] ?? 'DeepSeek'}
                    variant='bordered'
                    onValueChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
                />
            </div>
            <div className='config-item'>
                <Input
                    label={t('services.translate.deepseek.api_key')}
                    labelPlacement='outside-left'
                    type='password'
                    value={config.apiKey ?? ''}
                    variant='bordered'
                    onValueChange={(value) => setConfig({ ...config, apiKey: value })}
                />
            </div>
            <div className='config-item'>
                <h3 className='my-auto'>{t('services.translate.deepseek.model')}</h3>
                <Dropdown>
                    <DropdownTrigger>
                        <Button variant='bordered'>{config.model}</Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label='DeepSeek model'
                        selectedKeys={[config.model]}
                        selectionMode='single'
                        onAction={(key) => setConfig({ ...config, model: key.toString() })}
                    >
                        <DropdownItem key='deepseek-flash'>deepseek-flash</DropdownItem>
                        <DropdownItem key='deepseek-v4-pro'>deepseek-v4-pro</DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
            <div className='config-item'>
                <Switch
                    isSelected={Boolean(config.thinking)}
                    onValueChange={(value) => setConfig({ ...config, thinking: value })}
                    classNames={{ base: 'flex flex-row-reverse justify-between w-full max-w-full' }}
                >
                    {t('services.translate.deepseek.thinking')}
                </Switch>
            </div>
            <div className='config-item'>
                <Input
                    type='number'
                    label={t('services.translate.deepseek.max_tokens')}
                    labelPlacement='outside-left'
                    value={String(config.maxTokens ?? DEFAULT_REQUEST_ARGUMENTS.maxTokens)}
                    variant='bordered'
                    onValueChange={(value) => setConfig({ ...config, maxTokens: Number(value) || 1 })}
                />
            </div>
            <div className='config-item'>
                <Input
                    type='number'
                    step='0.01'
                    min='0.01'
                    max='1'
                    label={t('services.translate.deepseek.top_p')}
                    labelPlacement='outside-left'
                    value={String(config.topP ?? DEFAULT_REQUEST_ARGUMENTS.topP)}
                    variant='bordered'
                    onValueChange={(value) =>
                        setConfig({ ...config, topP: Number(value) || DEFAULT_REQUEST_ARGUMENTS.topP })
                    }
                />
            </div>
            <Textarea
                label={t('services.translate.deepseek.system_prompt')}
                value={config.promptList?.[0]?.content ?? DEFAULT_PROMPT_LIST[0].content}
                variant='bordered'
                onValueChange={(value) => updatePrompt(0, value)}
            />
            <Textarea
                label={t('services.translate.deepseek.user_prompt')}
                value={config.promptList?.[1]?.content ?? DEFAULT_PROMPT_LIST[1].content}
                variant='bordered'
                onValueChange={(value) => updatePrompt(1, value)}
            />
            <p className='text-small text-default-500'>{t('services.translate.deepseek.prompt_description')}</p>
            <Button
                type='submit'
                color='primary'
                fullWidth
                isLoading={isLoading}
            >
                {t('common.save')}
            </Button>
        </form>
    );
}
