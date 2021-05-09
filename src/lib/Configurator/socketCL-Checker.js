const socketCL = require('socket.io-client');

module.exports.isRunning = function (url) {
    return new Promise((resolve, reject) => {
        let Client = socketCL.io(url);
        Client.on('connect_error', () => {
            resolve(false);
        });
        Client.on('connect', () => {
            resolve(true);
        });
    });
};

module.exports.send = function (url, msg) {
    return new Promise((resolve, reject) => {
        let Client = socketCL.io(url);
        Client.on('connect_error', () => {
            reject('CONN_ERR');
        });
        Client.on('connect', () => {
            Client.send({
                "message": msg
            });
            resolve(true);
        });
    });
};