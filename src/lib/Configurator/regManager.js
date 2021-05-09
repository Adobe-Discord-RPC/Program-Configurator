const regedit = require('regedit');

module.exports.append = function (versions) {
    return new Promise((resolve, reject) => {
        regedit.putValue({
            'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Adobe_Discord_RPC_NodePort': {
                'DisplayVersion': {
                    value: 'Release ' + versions.release,
                    type: 'REG_SZ'
                },
                'ADRPC:Core_Version': {
                    value: versions.Core,
                    type: 'REG_SZ'
                },
                'ADRPC:Monitor_Version': {
                    value: versions.Monitor,
                    type: 'REG_SZ'
                },
                'ADRPC:Configurator_Version': {
                    value: versions.Configurator,
                    type: 'REG_SZ'
                },
                'ADRPC:Controller_Version': {
                    value: versions.Controller,
                    type: 'REG_SZ'
                }
            },
        }, function (err) {
            if (err) reject(err);
            resolve();
        });
    });
}