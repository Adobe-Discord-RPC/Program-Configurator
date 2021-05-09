const getTextColorByVer = (current, latest) => {
    if (current < latest) return "red-text";
    else return "green-text";
}

window.onload = async () => {
    $('.modal').modal();
    $('.tooltipped').tooltip();
    document.getElementById('linkOpenURL').onmouseover = () => {
        document.getElementById('linkOpenURL').select();
    }

    await wait(1500);

    let res = ipcRenderer.sendSync('getUpdates', 0);

    let coreUpdateRequired = "최신버전"
    let monitorUpdateRequired = "최신버전"
    let infoUpdateRequired = "최신버전"
    let configuratorUpdateRequired = "최신버전";
    let controllerUpdateRequired = "최신버전"; // TMI : 이렇게 적으니까 공산품 찍어낸 거 같음

    let coreTextColor = getTextColorByVer(res.Core.Current.version, res.Core.Latest.version);
    if (res.Core.UpdateRequired) coreUpdateRequired = "업데이트 필요";

    let monitorTextColor = getTextColorByVer(res.Monitor.Current.version, res.Monitor.Latest.version);
    if (res.Monitor.UpdateRequired) monitorUpdateRequired = "업데이트 필요";

    let infoTextColor = getTextColorByVer(res.Info.Current.version, res.Info.Latest.version);
    if (res.Info.UpdateRequired) infoUpdateRequired = "업데이트 필요";

    let configuratorTextColor = getTextColorByVer(res.Configurator.Current.version, res.Configurator.Latest.version);
    if (res.Configurator.UpdateRequired) configuratorUpdateRequired = "업데이트 필요";

    let controllerTextColor = getTextColorByVer(res.Controller.Current.version, res.Controller.Latest.version);
    if (res.Controller.UpdateRequired) controllerUpdateRequired = "업데이트 필요";

    document.getElementById('main_chart').innerHTML = `
        <tr>
            <td style="word-break: keep-all;">프로그램 코어</td>
            <td class="${coreTextColor}" style="word-break: keep-all;">v${res.Core.Current.version}</td>
            <td class="${coreTextColor}" style="word-break: keep-all;">v${res.Core.Latest.version}</td>
            <td class="${coreTextColor}" style="word-break: keep-all;">${coreUpdateRequired}</td>
            <td style="word-break: keep-all;"><a class="cyan-text" href="javascript:void(0);" onClick="openLink('${res.Core.Info}', false);">(링크)</a></td>
        </tr>
        <tr>
            <td style="word-break: keep-all;">프로그램 모니터</td>
            <td class="${monitorTextColor}" style="word-break: keep-all;">v${res.Monitor.Current.version}</td>
            <td class="${monitorTextColor}" style="word-break: keep-all;">v${res.Monitor.Latest.version}</td>
            <td class="${monitorTextColor}" style="word-break: keep-all;">${monitorUpdateRequired}</td>
            <td style="word-break: keep-all;"><a class="cyan-text" href="javascript:void(0);" onClick="openLink('${res.Monitor.Info}', false);">(링크)</a></td>
        </tr>
        <tr>
            <td style="word-break: keep-all;">지원 프로그램 목록</td>
            <td class="${infoTextColor}" style="word-break: keep-all;">v${res.Info.Current.version}</td>
            <td class="${infoTextColor}" style="word-break: keep-all;">v${res.Info.Latest.version}</td>
            <td class="${infoTextColor}" style="word-break: keep-all;">${infoUpdateRequired}</td>
            <td style="word-break: keep-all;"><a class="cyan-text" href="javascript:void(0);" onClick="openLink('${res.Info.Info}', false);">(링크)</a></td>
        </tr>
        <tr>
            <td style="word-break: keep-all;">프로그램 Configurator</td>
            <td class="${configuratorTextColor}" style="word-break: keep-all;">v${res.Configurator.Current.version}</td>
            <td class="${configuratorTextColor}" style="word-break: keep-all;">v${res.Configurator.Latest.version}</td>
            <td class="${configuratorTextColor}" style="word-break: keep-all;">${configuratorUpdateRequired}</td>
            <td style="word-break: keep-all;"><a class="cyan-text" href="javascript:void(0);" onClick="openLink('${res.Configurator.Info}', false);">(링크)</a></td>
        </tr>
        <tr>
            <td style="word-break: keep-all;">프로그램 컨트롤러</td>
            <td class="${controllerTextColor}" style="word-break: keep-all;">v${res.Controller.Current.version}</td>
            <td class="${controllerTextColor}" style="word-break: keep-all;">v${res.Controller.Latest.version}</td>
            <td class="${controllerTextColor}" style="word-break: keep-all;">${controllerUpdateRequired}</td>
            <td style="word-break: keep-all;"><a class="cyan-text" href="javascript:void(0);" onClick="openLink('${res.Controller.Info}', false);">(링크)</a></td>
        </tr>
    `;

    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    document.title = '업데이트 안내 - Adobe Discord RPC Updater';

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'block';
}

// TODO 2021-03-20: 뭐야 이거??? 나중에 합쳐라 (interErr+cancel)
ipcRenderer.on('interErr', (event, store) => {
    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    document.getElementById('spinner').style.display = 'none';
    document.getElementById('normal').style.display = 'none';
    document.getElementById('interErr').style.display = 'block';
    $('#exit_btn').attr('disabled', false);
    $('#back_gtn').attr('disabled', false);
});

ipcRenderer.on('cancel', (event, store) => {
    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    document.getElementById('spinner').style.display = 'none';
    document.getElementById('normal').style.display = 'none';
    document.getElementById('unable').style.display = 'block';
    $('#exit_btn').attr('disabled', false);
    $('#back_gtn').attr('disabled', false);
});