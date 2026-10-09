import fetch from 'node-fetch';
import fs from 'fs';

const repository = 'JouJouoo/tran';

async function resolveUpdater() {
    if (process.env.GITHUB_TOKEN === undefined) {
        throw new Error('GITHUB_TOKEN is required');
    }

    const token = process.env.GITHUB_TOKEN;
    const release = await getLatestRelease(token);
    const version = release.tag_name.replace(/^v/, '');
    const releaseTag = release.tag_name;
    const asset = `tran_${version}_x64-setup.nsis.zip`;
    const assetUrl = `https://github.com/${repository}/releases/download/${releaseTag}/${asset}`;

    const updateData = {
        name: version,
        notes: release.body ?? '',
        pub_date: new Date().toISOString(),
        platforms: {
            'windows-x86_64': {
                signature: await getSignature(`${assetUrl}.sig`),
                url: assetUrl,
            },
        },
    };
    fs.writeFileSync('./update.json', JSON.stringify(updateData));
}

async function getLatestRelease(token) {
    const res = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`GitHub release request failed: ${res.status}`);
    return res.json();
}

async function getSignature(url) {
    const response = await fetch(url);
    return response.ok ? response.text() : '';
}

resolveUpdater().catch(console.error);
