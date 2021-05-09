const version = "1.0-pre1";
const release_date = "2021-05-09";

// npm module
const {app, BrowserWindow, ipcMain, Notification, Tray, Menu} = require('electron');
const check = require('check-internet-connected');
const randomInt = require('random-int');
const child = require("child_process");
const find = require('find-process');
const wait = require('waait');
const path = require('path');
const open = require('open');
const fs = require('fs');

// custom module
const socket_CK = require('./lib/Configurator/socketCL-Checker');
const regManager = require('./lib/Configurator/regManager');
const FM = require('./lib/Configurator/fileManager');
const storage = require('./lib/localStorage');
const request = require('./lib/request');
const logger = require('./lib/logger');
const regedit = require('./lib/reg');

// variables
let regList, str, L, lang; // 전역변수
let tray, win; // 로드 속도 개선

// 공통 호출
const notify = (title='', body='', icon='') => new Notification({title, body, icon}).show();

const exit = async (exitCode=0) => {
    await L.info(`Configurator exit with Code ${exitCode}.\n`);
    app.quit();
    process.exit(exitCode);
}

const formatBytes = (bytes, decimals=2) => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const getSettings = async () => {
    let config = await str.get('Settings');
    if (isEmpty(config)) {
        await L.error('Config is empty!');
        await exit();
    }
    if (config.mode !== "Dev" && config.mode !== "Pub") {await L.error("Unknown setting value : mode."); await exit();}
    if (config.lang !== "ko" && config.lang !== "en") {await L.error("Unknown setting value : lang."); await exit();}
    return config;
}

const isEmpty = obj => {
    for (let key in obj) if (obj.hasOwnProperty(key)) return false;
    return true;
}

const isPortAvailable = async port => {
    let res = await find('port', port);
    return !res.length;
}

const checkConnection = async () => {
    try {
        await check({
            timeout: 3000,
            retries: 3,
            domain: '1.1.1.1'
        });
    } catch (e) {
        return {result: "Fail", lev: 0};
    }

    try {
        await check({
            timeout: 3000,
            retries: 3,
            domain: 'https://adobe.discordrpc.org/'
        });
    } catch (e) {
        return {result: "Fail", lev: 1};
    }

    try {
        await check({
            timeout: 3000,
            retries: 3,
            domain: 'https://cdn.discordrpc.org/'
        });
        return {result: "Success", lev: -1};
    } catch (e) {
        return {result: "Fail", lev: 2};
    }
}

/* --------------------------------------------- */

const show = async (page="1_select.html") => { // page -> html fileName
    const resConfig = await getSettings();
    await L.log('');
    await wait(3);
    await L.info('[show() INIT]');
    await wait(3);
    await L.info(`page : ${page}`);

    win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Screen Loading... - Adobe Discord RPC Configurator",
        icon: path.join(__dirname, 'img', 'configurator.png'),
        show: false,
        resizable: false,
        webPreferences: {
            contextIsolation: false, // 2021-03-21: 나 울거야,,
            nodeIntegration: true
        }
    });

    if (resConfig.mode !== "Dev") win.removeMenu();

    win.loadFile(path.join(__dirname, 'web', resConfig.lang, page));

    // HTML 로드 끝나고 창 표시
    win.once('ready-to-show', () => win.show());

    // 창닫기 방지
    win.on('close', async e => {
        e.preventDefault();
        win.webContents.executeJavaScript('M.Modal.getInstance(document.getElementById("exit_q")).open();').catch(async err => {
            if (err.toString() === "TypeError: Object has been destroyed") return;
            await L.warn("An expected error occurred in show() -> win.on('close') -> win.webContents.executeJavaScript()");
            await L.warn(err.toString());
        });
    });

    /* Page Event 처리 부분 - 공통 */
    ipcMain.on('closeWindow', async (event, arg) => {
        await L.info(`IPC : closeWindow() -> null`);
        await exit();
    });
    // 메인으로
    ipcMain.on('main', async (event, arg) => {
        await L.info(`IPC : main() -> null`);
        tray.setImage(path.join(__dirname, 'img', 'configurator_16_16.png'));
        win.setIcon(path.join(__dirname, 'img', 'configurator.png'));
        win.loadFile(path.join(__dirname, 'web', resConfig.lang, '1_select.html'));
    });

    /* Page Event 처리 부분 - 프로그램 설정 */
    // 설정값 리턴 요청
    ipcMain.on('getSettings', async (event, arg) => {
        await L.info(`IPC : getSettings() -> ${JSON.stringify(resConfig)}`);
        event.returnValue = resConfig
    });
    // 무작위 포트 요청
    ipcMain.on('getPorts', async (event, arg) => {
        let list = [];
        for (let i = 0; i < 5; i++) {
            let portNum1 = randomInt(1024, 65535);
            let portAvail1 = await isPortAvailable(portNum1);
            let portNum2 = randomInt(1024, 65535);
            let portAvail2 = await isPortAvailable(portNum2);
            list.push({num: [portNum1, portNum2], available: portAvail1 && portAvail2});
        }
        await L.info(`IPC : getPorts -> ${JSON.stringify(list)}`);
        event.returnValue = JSON.stringify(list);
    });
    // 로그 용량 요청
    ipcMain.on('getLogsSize', async (event, arg) => {
        let searchIndex = ['installer', 'monitor', 'sysInf', 'core', 'configurator', 'unknown'];
        let list = [];
        for (let i = 0; i < searchIndex.length; i++) {
            let nowAvailable;
            let nowFileSize = "Unknown";
            let nowFileName = resConfig.log.list[searchIndex[i]];
            let nowLoggerReturned = await L.checkFile(resConfig.log.save_fd, nowFileName);

            if (nowLoggerReturned.result === "Success" && nowLoggerReturned.code === "Exist") {
                nowAvailable = true;
                nowFileSize = formatBytes(nowLoggerReturned.size);
            } else if (nowLoggerReturned.result === "Success" && nowLoggerReturned.code === "ENOENT") {
                nowAvailable = false;
            } else {
                await L.error(`Unknown nowLoggerReturned : ${JSON.stringify(nowLoggerReturned)}`);
                await exit();
            }

            if (
                searchIndex[i] === "installer" ||
                searchIndex[i] === "monitor" ||
                searchIndex[i] === "sysInf" ||
                searchIndex[i] === "core" ||
                searchIndex[i] === "configurator" ||
                searchIndex[i] === "unknown"
            ) {
                list.push({fileName: nowFileName, description: lang.appjs.getLogsSize.description[searchIndex[i]], available: nowAvailable, size: {int: nowLoggerReturned.size, str: nowFileSize}});
            } else {
                await L.error(`Unknown searchIndex[i] : ${searchIndex[i]}`);
                await exit();
            }
        }

        await L.info(`IPC : getLogsSize() -> ${JSON.stringify([searchIndex, list])}`);
        event.returnValue = [searchIndex, list];
    });
    // 로그 제거 요청
    ipcMain.on('deleteLogs', async (event, arg) => {
        changeTrayMenu(true);
        await L.info(`IPC : deleteLogs(${JSON.stringify(arg)}) -> null`);
        for await (const nowArg of arg) {
            let res = await L.delFile(resConfig.log.save_fd, resConfig.log.list[nowArg]);
            if (res.result === "Fail") {
                await L.error(`An Error occurred at ipcMain.on('deleteLogs') -> ${JSON.stringify(res)}`);
                await win.webContents.executeJavaScript("document.getElementById('loading_description2').style.display = 'none';");
                await win.webContents.executeJavaScript("document.getElementById('loading_description3_1').style.display = 'block';");
                await wait(5000);
                await exit();
            }
        }
        await win.webContents.executeJavaScript("document.getElementById('loading_description2').style.display = 'none';");
        await win.webContents.executeJavaScript("document.getElementById('loading_description3_2').style.display = 'block';");
        await wait(5000);
        await L.info('restart');
        await app.relaunch();
        await exit();
    });
    // 로그 저장 요청
    ipcMain.on('saveConfig', async (event, arg) => {
        changeTrayMenu(true);
        await L.info(`IPC : saveConfig(${JSON.stringify(arg)}) -> null`);

        let old_config = await getSettings();

        let reloadTick;
        if (arg.mode === "Dev") {
            reloadTick = {
                "Dev": {
                    "processNF": arg.processNF,
                    "updateRPC": arg.updateRPC
                },
                "Pub": {
                    "processNF": old_config.reloadTick.Pub.processNF,
                    "updateRPC": old_config.reloadTick.Pub.updateRPC
                }
            };
        } else {
            reloadTick = {
                "Dev": {
                    "processNF": old_config.reloadTick.Dev.processNF,
                    "updateRPC": old_config.reloadTick.Dev.updateRPC
                },
                "Pub": {
                    "processNF": arg.processNF,
                    "updateRPC": arg.updateRPC
                }
            };
        }

        let data = {
            "mode": arg.mode,
            "ws": {
                "External": arg.externalPort,
                "Internal": arg.internalPort
            },
            "lang": old_config.lang,
            "log": {
                "save_fd": old_config.log.save_fd,
                "list": {
                    "installer": old_config.log.list.installer,
                    "monitor": old_config.log.list.monitor,
                    "sysInf": old_config.log.list.sysInf,
                    "core": old_config.log.list.core,
                    "configurator": old_config.log.list.configurator,
                    "unknown": old_config.log.list.unknown
                }
            },
            reloadTick,
            "useProgramInfo": ["RPCInfo_Official"]
        }

        await L.info(`save data : ${JSON.stringify(data)}`);

        try {
            await str.set('Settings', data);
        } catch (err) {
            await L.error(`An Error occurred at saveConfig : ${err.toString()}`);
            await win.webContents.executeJavaScript("document.getElementById('loading_description2').style.display = 'none';");
            await win.webContents.executeJavaScript("document.getElementById('loading_description3_1').style.display = 'block';");
            await wait(5000);
            await exit();
        }

        await win.webContents.executeJavaScript("document.getElementById('loading_description2').style.display = 'none';");
        await win.webContents.executeJavaScript("document.getElementById('loading_description3_2').style.display = 'block';");
        await wait(5000);
        await L.info('restart');
        try {
            await socket_CK.send(`ws://localhost:${old_config.ws.External}`, 'restart');
        } catch (err) {
            await L.warn(`An Error occurred while connecting monitor : ${err.toString()}`);
        }
        await app.relaunch();
        await exit();
    });

    /* Page Event 처리 부분 - 프로그램 업데이트 */
    // 업데이트 확인
    ipcMain.on('getUpdates', async (event, arg) => {
        tray.setImage(path.join(__dirname, 'img', 'updater_16_16.png'));
        win.setIcon(path.join(__dirname, 'img', 'updater.png'));
        changeTrayMenu(true);
        let interConn = await checkConnection();
        if (interConn.result === "Fail") {
            await L.info(`connection Check Failed : ${interConn.lev}`)
            await notify(lang.appjs.getUpdates.notify.updateCheckFailed.title, lang.appjs.getUpdates.notify.updateCheckFailed.body);
            changeTrayMenu(false);
            win.webContents.send('interErr', '-');
            return;
        }

        // 버전 취득
        let core = (regList['ADRPC:Core_Version'].value).split('(');
        let core_version = core[0]
        let core_release = core[1].replace(')', '');
        let monitor = (regList['ADRPC:Monitor_Version'].value).split('(');
        let monitor_version = monitor[0]
        let monitor_release = monitor[1].replace(')', '');
        let info = await str.get('RPCInfo_Official');
        let info_version = info[0].version;
        let info_release = info[0].release
        let configurator = (regList['ADRPC:Configurator_Version'].value).split('(');
        let configurator_version = configurator[0];
        let configurator_release = configurator[1].replace(')', '');
        let controller = (regList['ADRPC:Controller_Version'].value).split('(');
        let controller_version = controller[0];
        let controller_release = controller[1].replace(')', '');

        // 최신버전 List
        let release_date = await request.getJson("https://adobe.discordrpc.org/files/release/index.json");
        let core_latest = await request.getJson("https://adobe.discordrpc.org/files/Core/index.json");
        let monitor_latest = await request.getJson("https://adobe.discordrpc.org/files/Monitor/index.json");
        let info_latest = await request.getJson("https://adobe.discordrpc.org/files/SupportFiles/index.json");
        let configurator_latest = await request.getJson("https://adobe.discordrpc.org/files/Configurator/index.json");
        let controller_latest = await request.getJson("https://adobe.discordrpc.org/files/Controller/index.json");

        // Configurator에서 업데이트 가능한지 확인
        if (
            (parseFloat(core_latest[resConfig.mode].Update_min) > parseFloat(core_version)) ||
            (parseFloat(monitor_latest[resConfig.mode].Update_min) > parseFloat(monitor_version)) ||
            (parseFloat(info_latest[resConfig.mode].Update_min) > parseFloat(info_version)) ||
            (parseFloat(configurator_latest[resConfig.mode].Update_min) > parseFloat(configurator_version)) ||
            (parseFloat(controller_latest[resConfig.mode].Update_min) > parseFloat(controller_version))
        ) {
            await L.info('cannot update through configurator');
            await wait(3);
            await L.info(`Core min : v${core_latest[resConfig.mode].Update_min} (Current : v${core_version})`);
            await L.info(`Monitor min : v${monitor_latest[resConfig.mode].Update_min} (Current : v${monitor_version})`);
            await L.info(`Info min : v${info_latest[resConfig.mode].Update_min} (Current : v${info_version})`);
            await L.info(`Configurator min : v${configurator_latest[resConfig.mode].Update_min} (Current : v${configurator_version})`);
            await L.info(`Controller min : v${controller_latest[resConfig.mode].Update_min} (Current : v${controller_version})`);
            await notify(lang.appjs.getUpdates.notify.unableAutoUpdate.title, lang.appjs.getUpdates.notify.unableAutoUpdate.body);
            changeTrayMenu(false);
            win.webContents.send('cancel', '-');
            return;
        }

        // 업데이트 할 때 쓸 데이터 + 웹에 보낼 데이터
        let list = {
            release: release_date.date,
            "Core": {
                UpdateRequired: parseFloat(core_version) < parseFloat(core_latest[resConfig.mode].latest),
                Info: core_latest[resConfig.mode].info,
                Current: {
                    version: core_version,
                    release: core_release
                },
                Latest: {
                    version: core_latest[resConfig.mode].latest,
                    release: core_latest[resConfig.mode].updated
                },
                File: core_latest[resConfig.mode].file
            },
            "Monitor": {
                UpdateRequired: parseFloat(monitor_version) < parseFloat(monitor_latest[resConfig.mode].latest),
                Info: monitor_latest[resConfig.mode].info,
                Current: {
                    version: monitor_version,
                    release: monitor_release
                },
                Latest: {
                    version: monitor_latest[resConfig.mode].latest,
                    release: monitor_latest[resConfig.mode].updated
                },
                File: monitor_latest[resConfig.mode].file
            },
            "Info": {
                UpdateRequired: parseFloat(info_version) < parseFloat(info_latest[resConfig.mode].latest),
                Info: info_latest[resConfig.mode].info,
                Current: {
                    version: info_version,
                    release: info_release
                },
                Latest: {
                    version: info_latest[resConfig.mode].latest,
                    release: info_latest[resConfig.mode].updated
                },
                File: info_latest[resConfig.mode].file
            },
            "Configurator": {
                UpdateRequired: parseFloat(configurator_version) < parseFloat(configurator_latest[resConfig.mode].latest),
                Info: configurator_latest[resConfig.mode].info,
                Current: {
                    version: configurator_version,
                    release: configurator_release
                },
                Latest: {
                    version: configurator_latest[resConfig.mode].latest,
                    release: configurator_latest[resConfig.mode].updated
                },
                File: configurator_latest[resConfig.mode].file
            },
            "Controller": {
                UpdateRequired: parseFloat(controller_version) < parseFloat(controller_latest[resConfig.mode].latest),
                Info: controller_latest[resConfig.mode].info,
                Current: {
                    version: controller_version,
                    release: controller_release
                },
                Latest: {
                    version: controller_latest[resConfig.mode].latest,
                    release: controller_latest[resConfig.mode].updated
                },
                File: controller_latest[resConfig.mode].file
            }
        };

        // TODO 2021-02-09: 딜레이 안주니까 파일 삭제에서 밀리는거 같기도 함. 확인필요
        await str.remove('Update');
        await wait(3);
        await str.create('Update');
        await wait(3);
        await str.set('Update', list);

        changeTrayMenu(false);
        await L.info(`IPC : getUpdates -> ${JSON.stringify(list)}`);
        event.returnValue = list;
    });
    // 업데이트 진행
    ipcMain.on('runUpdate', async (event, arg) => {
        let breaked = false; // true면 업데이트 중단
        await L.info(`IPC : runUpdate() -> null`);

        changeTrayMenu(true);
        await win.loadFile(path.join(__dirname, 'web', resConfig.lang, '3-3_updating.html'));

        // 폴더 완전히 삭제
        const delFolder = async dir => {
            let fdList = fs.readdirSync(dir);
            for(let i = 0; i < fdList.length; i++) {
                let filename = path.join(dir, fdList[i]);
                let stat = fs.statSync(filename);

                if(filename == "." || filename == "..") {
                    // pass these files
                } else if(stat.isDirectory()) {
                    // rmdir recursively
                    fs.rmdirSync(filename, {recursive: true});
                } else {
                    // rm fiilename
                    fs.unlinkSync(filename);
                }
            }
            await fs.rmdirSync(dir, {recursive: true});
        }
        // 업데이트 작업 중 로딩바 수정
        const changeProgress = async width => {
            await L.log(`ChangeProgress : ${width}%`);
            win.webContents.send('changeProgress', width);
        }
        // 업데이트 과정 중 로그 갱신 작업용
        const appendLog = async msg => {
            await L.log(`APPEND : ${msg.replace(/\n/gim, '\\n')}`);
            win.webContents.send('appendLog', msg);
        }
        // 업데이트 취소
        const cancelTask = async () => {
            breaked = true;
            await win.webContents.send('UpdateErr', '-');
        }

        await wait(1000); // 대기

        await appendLog(`\n${lang.appjs.runUpdate.logMessage.checkConnection.checking}`);
        let interConn = await checkConnection();
        if (interConn.result === "Fail") {
            await L.info(`connection Check Failed : ${interConn.lev}`);
            await appendLog(`\n\n\n\n\n\n\n\n\n${lang.appjs.runUpdate.logMessage.checkConnection.checkingFailed}\n\n\n\n`);
            await notify(lang.appjs.runUpdate.notify.connectFailed.title, lang.appjs.runUpdate.notify.connectFailed.body);
            changeTrayMenu(false);
            await cancelTask();
            return;
        }
        await wait(30);
        await appendLog(lang.appjs.runUpdate.logMessage.checkConnection.connected);

        await appendLog(`\n${lang.appjs.runUpdate.logMessage.loadInfo.loading}`);
        await wait(70);
        let list = await str.get('Update');
        await appendLog(lang.appjs.runUpdate.logMessage.loadInfo.loaded);

        await wait(500);

        await appendLog(`\n${lang.appjs.runUpdate.logMessage.checkRunning.checking}`);
        let monitorRunning = await socket_CK.isRunning(`ws://localhost:${resConfig.ws.External}`);
        if (monitorRunning) {
            await appendLog(lang.appjs.runUpdate.logMessage.checkRunning.running);
            try {
                await socket_CK.send(`ws://localhost:${resConfig.ws.External}`, 'exit');
                await appendLog(lang.appjs.runUpdate.logMessage.checkRunning.killSucceed);
            } catch {
                await notify(lang.appjs.getUpdates.notify.monitorKillFailed.title, lang.appjs.getUpdates.notify.monitorKillFailed.body);
                await appendLog(`\n\n\n\n\n\n\n\n\n${lang.appjs.runUpdate.logMessage.checkRunning.killFailed}\n\n\n`);
                changeTrayMenu(false);
                await cancelTask();
                return;
            }
        } else {
            await appendLog(lang.appjs.runUpdate.logMessage.checkRunning.notRunning);
        }

        await wait(500);

        await appendLog(`\n${lang.appjs.runUpdate.logMessage.folerInit.start}`);
        let temp_path = path.join(regList.InstallLocation.value, 'temp_configurator');
        let dl_path = path.join(regList.InstallLocation.value, 'temp_configurator', 'dl');
        let upk_path = path.join(regList.InstallLocation.value, 'temp_configurator', 'upk'); // Unpack
        if (await fs.existsSync(temp_path)) await delFolder(temp_path);
        await fs.mkdirSync(temp_path);
        if (await fs.existsSync(dl_path)) await delFolder(dl_path);
        await fs.mkdirSync(dl_path);
        if (await fs.existsSync(upk_path)) await delFolder(upk_path);
        await fs.mkdirSync(upk_path);
        await wait(20);
        await appendLog(lang.appjs.runUpdate.logMessage.folerInit.succeed);

        await wait(300);

        let prList = [ // 도저히 이걸 일일히 만들기에는 너무 길어서 반복문 처리,,
            {
                JSONIndex: "Core",
                fileName: "core",
                displayName: lang.appjs.runUpdate.prListDisplayName.Core
            },
            {
                JSONIndex: "Monitor",
                fileName: "monitor",
                displayName: lang.appjs.runUpdate.prListDisplayName.Monitor
            },
            {
                JSONIndex: "Info",
                fileName: "sp_list_official",
                displayName: lang.appjs.runUpdate.prListDisplayName.Info
            },
            {
                JSONIndex: "Configurator",
                fileName: "config",
                displayName: lang.appjs.runUpdate.prListDisplayName.Configurator
            },
            {
                JSONIndex: "Controller",
                fileName: "controller",
                displayName: lang.appjs.runUpdate.prListDisplayName.Controller
            }
        ];

        for (let i = 0; i < prList.length; i++) {
            if (list[prList[i].JSONIndex].UpdateRequired && !breaked) {
                await appendLog(`\n${lang.appjs.runUpdate.logMessage.fileDownload.start.replace('%DISPLAYNAME%', prList[i].displayName)}`);
                await wait(70);
                try {
                    await L.info(`Downloading ${prList[i].JSONIndex} : ${list[prList[i].JSONIndex].File.url}`);
                    await FM.downloadFile(list[prList[i].JSONIndex].File.url, path.join(dl_path, `${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}.adrdownload`), true);
                } catch (err) {
                    await L.error(`${prList[i].JSONIndex} DL Error : ${err.toString()}`);
                    await notify(lang.appjs.getUpdates.notify.programDownloadFailed.title, lang.appjs.getUpdates.notify.programDownloadFailed.body);
                    await appendLog(`\n\n\n\n\n\n\n\n\n\n${lang.appjs.runUpdate.logMessage.fileDownload.failed}\n\n\n\n\n`);
                    await cancelTask();
                    return;
                }
                await appendLog(lang.appjs.runUpdate.logMessage.fileDownload.succeed.replace('%DISPLAYNAME%', prList[i].displayName));
                await wait(50);

                //await appendLog("\n다운받은 파일에 대한 무결성을 검사합니다.");
                //await wait(50);

                if (list[prList[i].JSONIndex].File.hash['SHA-1'] === "bypass") {
                    await L.info(`SHA-1 ${prList[i].JSONIndex} checksum bypass.`);
                } else {
                    let res1 = await FM.checkHash(path.join(dl_path, `${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}.adrdownload`), 'sha1', list[prList[i].JSONIndex].File.hash['SHA-1']);
                    if (res1[0]) {
                        await L.info(`SHA-1 ${prList[i].JSONIndex} checksum success.`);
                    } else {
                        await L.error(`SHA-1 ${prList[i].JSONIndex} checksum is NOT EQUAL!!!`);
                        await L.error(`Server : ${res1[2]} || Local : ${res1[1]}`);
                        await notify(lang.appjs.runUpdate.notify.fileChecksumNotEqual.title, lang.appjs.runUpdate.notify.fileChecksumNotEqual.body);
                        await appendLog(`\n\n\n\n\n\n\n\n\n\n${lang.appjs.runUpdate.logMessage.fileValidate.failed}\n\n\n\n\n`);
                        await cancelTask();
                        return;
                    }
                }
                if (list[prList[i].JSONIndex].File.hash['MD5'] === "bypass") {
                    await L.info(`MD5 ${prList[i].JSONIndex} checksum bypass.`);
                } else {
                    let res2 = await FM.checkHash(path.join(dl_path, `${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}.adrdownload`), 'md5', list[prList[i].JSONIndex].File.hash['MD5']);
                    if (res2[0]) {
                        await L.info(`MD5 ${prList[i].JSONIndex} checksum success.`);
                    } else {
                        await L.error(`MD5 ${prList[i].JSONIndex} checksum is NOT EQUAL!!!`);
                        await L.error(`Server : ${res2[2]} || Local : ${res2[1]}`);
                        await notify(lang.appjs.getUpdates.notify.fileChecksumNotEqual.title, lang.appjs.getUpdates.notify.fileChecksumNotEqual.body);
                        await appendLog(`\n\n\n\n\n\n\n\n\n\n${lang.appjs.runUpdate.logMessage.fileValidate.failed}\n\n\n\n\n`);
                        await cancelTask();
                        return;
                    }
                }
                await appendLog(lang.appjs.runUpdate.logMessage.fileValidate.succeed);
            }
        }

        // TODO 2021-03-21: 코드 구조 박살나기 시작함. 4.0 이후 버전에서 수정필요
        // TODO 2021-04-30: v4.0 공개배포(영문) 이후 자체 업데이터 사용 예정. 그전에 수정 해놓자,,
        if (breaked) {
            //
        } else {
            await wait(230);
            await appendLog(`\n${lang.appjs.runUpdate.logMessage.fileUnpack.start}`);
            for (let i = 0; i < prList.length; i++) {
                if (list[prList[i].JSONIndex].UpdateRequired && !breaked) {
                    now_path = path.join(upk_path, `${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}`);
                    await fs.mkdirSync(now_path);
                    await L.info(`Starting unpack ${prList[i].JSONIndex} (${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}.adrdownload)`);
                    try {
                        await FM.unPack(path.join(dl_path, `${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}.adrdownload`), now_path);
                        await L.info(`Successfully unpacked to ${now_path}`);
                    } catch (err) {
                        await L.error(`Failed to unpack ${now_path}`);
                        await L.error(err.toString());
                        await notify(lang.appjs.getUpdates.notify.fileUnpackFailed.title, lang.appjs.getUpdates.notify.fileUnpackFailed.body);
                        await appendLog(`\n\n\n\n\n\n\n\n\n\n${lang.appjs.runUpdate.logMessage.fileUnpack.failed}\n\n\n\n\n`);
                        await cancelTask();
                        return;
                    }
                }
            }
            await appendLog(lang.appjs.runUpdate.logMessage.fileUnpack.succeed);

            await wait(230);

            await appendLog(`\n임시폴더에 압축을 푼 파일을 이동하고 있습니다.\nPC 사양에 따라 1분 정도 소요됩니다.`);
            for (let i = 0; i < prList.length; i++) {
                if (list[prList[i].JSONIndex].UpdateRequired && !breaked && prList[i].JSONIndex !== "Controller") { // 컨트롤러는 별도 처리
                    //list[prList[i].JSONIndex].File.(unpack/folderReset)
                    let originFolder = path.join(upk_path, `${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}`);
                    let originFolder_Renamed = path.join(upk_path, list[prList[i].JSONIndex].File.unpack.replace("%RootPath%", ".")); // 임시 폴더 내에서의 Rename용 변수
                    let destFolder = path.join(regList.InstallLocation.value, list[prList[i].JSONIndex].File.unpack.replace("%RootPath%", "."));

                    if (list[prList[i].JSONIndex].File.folderReset) {
                        await L.info(`Starting reset folder : ${list[prList[i].JSONIndex].File.unpack} (fact : ${destFolder})`);
                        if (await fs.existsSync(destFolder)) await delFolder(destFolder);
                        await L.info(`successfully reset folder : ${list[prList[i].JSONIndex].File.unpack} (fact : ${destFolder})`);
                    } else if (prList[i].JSONIndex === "Info") { // 기존 폴더에 있던 파일 다 임시 폴더로 옮기고 통째로 이동하는 그런 식,,,,,
                        await L.info(`Starting copy folder : ${destFolder} -> ${originFolder}`);
                        let fileList = await fs.readdirSync(destFolder);
                        for (let i = 0; i < fileList.length; i++) {
                            await fs.copyFileSync(path.join(destFolder, fileList[i]), path.join(originFolder, fileList[i]), fs.constants.COPYFILE_EXCL);
                        }
                        await L.info(`successfully copy folder : ${destFolder} -> ${originFolder}`);

                        await L.info(`Starting reset folder : ${list[prList[i].JSONIndex].File.unpack} (fact : ${destFolder})`);
                        if (await fs.existsSync(destFolder)) await delFolder(destFolder);
                        await L.info(`successfully reset folder : ${list[prList[i].JSONIndex].File.unpack} (fact : ${destFolder})`);
                    }

                    await L.info(`moving folder ${originFolder} -> ${originFolder_Renamed} -> ${destFolder}`);
                    try {
                        //await fs.mkdirSync(destFolder);
                        await fs.renameSync(originFolder, originFolder_Renamed);
                        await FM.mv(originFolder_Renamed, regList.InstallLocation.value);
                    } catch (err) {
                        await L.error(`Failed to moving folder ${originFolder} -> ${destFolder}`);
                        await L.error(err.toString());
                        await notify("파일 이동에 실패했습니다.", "이 문제가 지속되면 공식 서버에 알려주세요.");
                        await appendLog(`\n\n\n\n\n\n\n\n\n\n파일 이동에 실패했습니다.\n이 문제가 지속되면 공식 서버에 알려주세요 : https://discord.gg/7MBYbERafX\n\n\n\n\n`);
                        await cancelTask();
                        return;
                    }
                } else if (list[prList[i].JSONIndex].UpdateRequired && !breaked && prList[i].JSONIndex === "Controller") {
                    let copyFrom = path.join(list[prList[i].JSONIndex].File.copyFrom.replace("%TempPath%", path.join(upk_path, `${prList[i].fileName}_${list[prList[i].JSONIndex].Latest.release}`)));
                    let copyTo = path.join(list[prList[i].JSONIndex].File.copyTo.replace("%RootPath%", regList.InstallLocation.value));
                    await L.info(`Starting copy file : ${copyFrom} -> ${copyTo}`);
                    try {
                        let fromData = await fs.readFileSync(copyFrom);
                        await fs.writeFileSync(copyTo, fromData);
                        //await fs.copyFileSync(copyFrom, copyTo, fs.constants.COPYFILE_FICLONE_FORCE);
                    } catch (err) {
                        await L.error(`Failed to copy file : ${copyFrom} -> ${copyTo}`);
                        await L.error(err.toString());
                        await notify("파일 이동에 실패했습니다.", "이 문제가 지속되면 공식 서버에 알려주세요.");
                        await appendLog(`\n\n\n\n\n\n\n\n\n\n파일 이동에 실패했습니다.\n이 문제가 지속되면 공식 서버에 알려주세요 : https://discord.gg/7MBYbERafX\n\n\n\n\n`);
                        await cancelTask();
                        return;
                    }
                    await L.info(`successfully copy file : ${copyFrom} -> ${copyTo}`);
                }
            }
            await appendLog('성공적으로 파일을 이동했습니다.');

            await wait(380);

            await appendLog('\n변경된 사항을 레지스트리에 등록하고 있습니다.');
            let Core = regList['ADRPC:Core_Version'].value;
            let Monitor = regList['ADRPC:Core_Version'].value;
            let Configurator = regList['ADRPC:Core_Version'].value;
            let Controller = regList['ADRPC:Core_Version'].value;
            if (list.Core.UpdateRequired) Core = `${list.Core.Latest.version} (${list.Core.Latest.release})`;
            if (list.Monitor.UpdateRequired) Monitor = `${list.Monitor.Latest.version} (${list.Monitor.Latest.release})`;
            if (list.Configurator.UpdateRequired) Configurator = `${list.Configurator.Latest.version} (${list.Configurator.Latest.release})`;
            if (list.Controller.UpdateRequired) Controller = `${list.Controller.Latest.version} (${list.Controller.Latest.release})`;
            await regManager.append({
                release: list.release,
                Core, Monitor, Configurator, Controller
            });
            await appendLog('성공적으로 레지스트리에 등록했습니다.');

            await wait(260);

            await appendLog('\n마무리 중입니다.');
            await delFolder(temp_path);
            await wait(850);
            // TODO 2021-04-19: 업데이트 결과 저장해서 html로 넘겨야함. 3-4번 html 작업도 안되어 있고.
            let config = await getSettings();
            win.loadFile(path.join(__dirname, 'web', config.lang, '3-4_updated.html'));
        }
    });

    /* Page Event 처리 부분 - 프로그램 제거 */
    // 경고 메시지 반환 요청
    ipcMain.on('getDeleteWarningMessage', async (event, arg) => {
        let resMsg = "Fail";
        let interConn = await checkConnection();

        if (interConn.result === "Fail") await L.info(`connection Check Failed : ${interConn.lev}`);
        else resMsg = (await request.getJson("https://adobe.discordrpc.org/files/release/index.json")).delWarn[resConfig.lang];

        await L.info(`IPC : getDeleteWarningMessage() -> "${resMsg}"`);
        event.returnValue = resMsg;
    });
    // 프로그램 삭제 진행
    ipcMain.on('performDel', async (event, arg) => {
        await L.info(`IPC : performDel() -> ${JSON.stringify(arg)}`);
        await wait(1300)
        if (!arg.agree) {
            win.webContents.send('chkErr', '-');
            return;
        }

        await win.loadFile(path.join(__dirname, 'web', resConfig.lang, '4-2_deleting.html'));
    });
}

/* --------------------------------------------- */

const changeTrayMenu = async (hideShortCut=false) => { // 페이지 바로가기 트래이에서 숨길지 여부
    let config = await getSettings();

    let menu = [
        {label: 'Adobe Discord RPC Configurator', enabled: false, icon: path.join(__dirname, 'img', 'configurator_16_16.png')},
        {label: `${lang.appjs.tray.version} ${version} (${release_date})`, enabled: false},
        {type: 'separator'},
        {label: lang.appjs.tray.homepage, click: () => open("https://adobe.discordrpc.org")},
        {label: lang.appjs.tray.discord, click: () => open("https://discord.gg/7MBYbERafX")}
    ]
    if (hideShortCut) {
        menu.push({type: 'separator'});
        for (let i = 0; i < lang.appjs.tray.disabled.length; i++) menu.push({label: lang.appjs.tray.disabled[i], enabled: false});
    } else {
        menu.push(
            {type: 'separator'},
            {label: lang.appjs.tray.programConfig, click: () => {
                tray.setImage(path.join(__dirname, 'img', 'configurator_16_16.png'));
                win.setIcon(path.join(__dirname, 'img', 'configurator.png'));
                win.loadFile(path.join(__dirname, 'web', config.lang, '2-1_configurating.html'));
            }},
            // TODO
            //{label: lang.appjs.tray.checkUpdate, click: () => {
            //    tray.setImage(path.join(__dirname, 'img', 'updater_16_16.png'));
            //    win.setIcon(path.join(__dirname, 'img', 'updater.png'));
            //    win.loadFile(path.join(__dirname, 'web', config.lang, '3-2_update_collected.html'));
            //}},
            //{label: lang.appjs.tray.programDelete, click: () => {
            //        //TODO: icon
            //        tray.setImage(path.join(__dirname, 'img', 'configurator_16_16.png'));
            //        win.setIcon(path.join(__dirname, 'img', 'configurator.png'));
            //
            //        win.loadFile(path.join(__dirname, 'web', config.lang, '4-1_check.html'));
            //}},

            {label: lang.appjs.tray.checkUpdate, enabled: false},
            {label: lang.appjs.tray.programDelete, enabled: false},
            {type: 'separator'},
            {label: lang.appjs.tray.exit, click: () => exit()}
        );
    }

    tray.setContextMenu(Menu.buildFromTemplate(menu));
}

const init = async config => {
    // Logger Init
    let res = await L.init();
    if (!res) process.exit(1);

    // Check
    if (isEmpty(config)) {
        await L.error('Config is empty!');
        await exit(1);
    }
    if (config.mode !== "Dev" && config.mode !== "Pub") {await L.error("Unknown setting value : mode."); await exit(1);}
    if (config.lang !== "ko" && config.lang !== "en") {await L.error("Unknown setting value : lang."); await exit(1);}
    let arg = "";
    if (await fs.existsSync(path.join(regList.InstallLocation.value, 'run_args', 'Configurator.json'))) {
        try {
            arg = (require(path.join(regList.InstallLocation.value, 'run_args', 'Configurator.json')))['option'];
            await fs.unlinkSync(path.join(regList.InstallLocation.value, 'run_args', 'Configurator.json'));
        } catch (err) {
            await L.error(`Failed to read OR unlink argument : ${err.toString()}`);
            await exit(1);
        }
    }

    // Info Log
    await L.info('[Configurator INFO]');
    await wait(3);
    await L.info(`Release : v${version} (${release_date})`);
    await L.info(`Runtime : ${process.version}`);
    await L.info(`PID : ${process.pid}`);
    await L.info(`PPID : ${process.ppid}`);
    await L.info(`Language : ${config.lang}`);
    await L.info(`Mode : ${config.mode}`);
    await L.info(`Argument : ${arg}`);
    await wait(3);
    await L.log('');

    // Args Check
    switch (arg) {
        case "Setup":
            show("2-1_configurating.html");
            break;
        // TODO
        //case "Update":
        //    show("3-2_update_collected.html");
        //    break;
        //case "Delete":
        //    show("4-1_check.html");
        //    break;
        default:
            show();
            break;
    }
}

app.whenReady().then(async () => {
    // Init
    regList = await regedit.list('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Adobe_Discord_RPC_NodePort');
    str = new storage(regList.InstallLocation.value);

    const config = await getSettings();
    L = new logger(regList.InstallLocation.value, `Configurator(${process.pid})`, config);

    // language load
    lang = require(path.join(__dirname, 'lang', `${config.lang}.json`));

    // Electron Init
    app.setName('Adobe Discord RPC Configurator');
    app.setAppUserModelId('Adobe Discord RPC Configurator');

    child.exec('NET SESSION', async function(err,so,se) {
        if (se.length !== 0) {
            console.log("The process is not running with administrator privileges!")
            process.exit(0);
        } else {
            // SYS Tray Init
            tray = new Tray(path.join(__dirname, 'img', 'configurator.png'));
            tray.setToolTip('Adobe Discord RPC Configurator');
            changeTrayMenu(false);

            init(config);
        }
    });
});
