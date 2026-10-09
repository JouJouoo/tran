import { Divider, Button } from '@nextui-org/react';
import { appLogDir, appConfigDir } from '@tauri-apps/api/path';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/shell';
import { BsGithub } from 'react-icons/bs';
import { invoke } from '@tauri-apps/api';
import React from 'react';

import { appVersion } from '../../../../utils/env';

const REPOSITORY_URL = 'https://github.com/JouJouoo/tran';

export default function About() {
    const { t } = useTranslation();

    return (
        <div className='h-full w-full py-[80px] px-[100px]'>
            <img
                src='icon.png'
                className='mx-auto h-[100px] mb-[5px]'
                draggable={false}
            />
            <div className='content-center'>
                <h1 className='font-bold text-2xl text-center'>tran</h1>
                <p className='text-center text-sm text-gray-500 mb-[5px]'>{appVersion}</p>
                <p className='text-center text-sm text-gray-500 mb-[15px]'>{t('config.about.description')}</p>
                <Divider />
                <div className='flex justify-center'>
                    <Button
                        variant='light'
                        className='my-[5px]'
                        size='sm'
                        startContent={<BsGithub />}
                        onPress={() => open(REPOSITORY_URL)}
                    >
                        {t('config.about.github')}
                    </Button>
                </div>
                <Divider />
            </div>
            <div className='content-center px-[40px]'>
                <div className='flex justify-between'>
                    <Button
                        variant='light'
                        className='my-[5px]'
                        size='sm'
                        onPress={() => invoke('updater_window')}
                    >
                        {t('config.about.check_update')}
                    </Button>
                    <Button
                        variant='light'
                        className='my-[5px]'
                        size='sm'
                        onPress={async () => open(await appLogDir())}
                    >
                        {t('config.about.view_log')}
                    </Button>
                    <Button
                        variant='light'
                        className='my-[5px]'
                        size='sm'
                        onPress={async () => open(await appConfigDir())}
                    >
                        {t('config.about.view_config')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
