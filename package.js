const packager = require('electron-packager');
const path = require('path');

async function packageApp() {
    console.log('packaging ready');
    await packager({
        arch: 'x64',
        platform: 'win32',
        dir: './',
        out: './build',
        overwrite: true,
        icon: path.join(__dirname, 'src', 'img', 'configurator.ico'),
        ignore: ['.idea', '.git', '.github', '.gitignore', 'logs'],
        name: 'ADRPC_Configurator',
        usageDescription: 'Adobe Discord RPC Configurator.',
        appCopyright: '2020-2021 Adobe Discord RPC Team.',
        buildVersion: '2021.05.09.01',
        appVersion: '1.0-pre1'
    });
    console.log('packaging finish');
}

console.log('WARNING :: Please, delete \'./build\' folder before run build');
packageApp();