const searchIndex = ['installer', 'monitor', 'sysInf', 'core', 'configurator', 'unknown'];

window.onload = async () => {
    await wait(100);

    let settings = ipcRenderer.sendSync('getSettings', 0);

    let index = 1;
    if (settings.mode === "Dev") index = 2;

    document.getElementById("port1").value = settings.ws.External;
    document.getElementById("port2").value = settings.ws.Internal;
    document.getElementById("Mode").selectedIndex = index;
    document.getElementById("processNF").value = settings.reloadTick[settings.mode].processNF;
    document.getElementById("updateRPC").value = settings.reloadTick[settings.mode].updateRPC;

    // init
    $('.modal').modal();
    $('.tooltipped').tooltip();
    $('select').formSelect();
    document.getElementById('linkOpenURL').onmouseover = () => {
        document.getElementById('linkOpenURL').select();
    }

    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'block';
}

/* --------------------------------------------- */

const getPorts = async () => {
    document.getElementById('randomPick_Loading').style.display = 'block';
    document.getElementById('randomPick_Main').style.display = 'none';
    M.Modal.getInstance(document.getElementById("randomPick")).open();

    await wait(1000);

    let ports_txt = ipcRenderer.sendSync('getPorts', 0);
    let ports_obj = JSON.parse(ports_txt);

    let status;
    for (let i = 0; i < ports_obj.length; i++) {
        if (ports_obj[i].available) {
            status = `
                <td style="word-break: keep-all;" class="green-text">포트 사용 가능</td>
                <td><a class="waves-effect waves-light btn-small tooltipped" onClick="changePort(${JSON.stringify(ports_obj[i].num)})" data-position="top" data-tooltip="클릭하여 통신용 포트를 변경합니다."><i class="material-icons left">check</i> 사용하기</a></td>
            `;
        } else {
            status = `
                <td style="word-break: keep-all;" class="red-text">포트 사용 불가능</td>
                <td><a class="waves-effect waves-light btn-small tooltipped grey" data-position="top" data-tooltip="사용할 수 없는 포트입니다."><i class="material-icons left">close</i> 사용불가</a></td>
            `;
        }

        document.getElementById(`randomPick_Table${i}`).innerHTML = `
            <td style="word-break: keep-all;">${i+1}</td>
            <td style="word-break: keep-all;">${ports_obj[i].num[0]}</td>
            <td style="word-break: keep-all;">${ports_obj[i].num[1]}</td>
            ${status}
        `;
    }

    document.getElementById('randomPick_Loading').style.display = 'none';
    document.getElementById('randomPick_Main').style.display = 'block';
}

const changePort = ports => {
    document.getElementById('port1').value = ports[0];
    document.getElementById('port2').value = ports[1];
    M.Modal.getInstance(document.getElementById("randomPick")).close();
}

/* --------------------------------------------- */

const onModeChange = async sel => {
    M.toast({html: '설정 정보를 다시 불러옵니다.', classes: 'rounded'});

    document.getElementById('cannot_exit_t').style.display = 'block';
    document.getElementById('cannot_exit_b').style.display = 'block';
    document.getElementById('exit_t').style.display = 'none';
    document.getElementById('exit_b').style.display = 'none';

    document.getElementById('loading').style.display = 'block';
    document.getElementById('main').style.display = 'none';

    await wait(500);

    if (sel.value !== "Pub" && sel.value !== "Dev") {
        showErr("실행 모드(일반/개발)가 유효하지 않습니다!");
        throw 'expected';
    }

    let settings = ipcRenderer.sendSync('getSettings', 0);
    document.getElementById('processNF').value = settings.reloadTick[sel.value].processNF;
    document.getElementById('updateRPC').value = settings.reloadTick[sel.value].updateRPC;

    M.toast({html: '설정 정보를 다시 불러왔습니다.', classes: 'rounded'});

    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'block';
}

/* --------------------------------------------- */

const getLogs = async () => {
    document.getElementById('deleteLog_Select_Loading').style.display = 'block';
    document.getElementById('deleteLog_Select_Main').style.display = 'none';
    M.Modal.getInstance(document.getElementById("deleteLog_Select")).open();

    await wait(800);

    let res = ipcRenderer.sendSync('getLogsSize', 0);
    let html = '';

    for (let i = 0; i < res[0].length; i++) {
        let status;
        let status_col;
        let disabled = "";
        if (res[1][i].available) {
            if (res[1][i].size.int <= 512000) { // 500KB
                status_col = "green-text";
                status = "삭제 불필요";
            } else if (res[1][i].size.int <= 1048576) { // 1MB
                status_col = "orange-text";
                status = "삭제 권장";
            } else {
                status_col = "red-text";
                status = "삭제 필요"
            }
            status = `<td class="${status_col}" style="word-break: keep-all;">${res[1][i].size.str} (${status})</td>`;
        } else { // not
            disabled = " disabled";
            status = '<td class="grey-text" style="word-break: keep-all;">(파일 없음)</td>';
        }

        html += `
            <tr>
                <td><label>&nbsp;&nbsp;<input type="checkbox" id="${res[0][i]}" class="check" href="javascript:void(0);" OnClick="check();"${disabled} /><span></span></label></td>
                <td style="word-break: keep-all;">${res[1][i].fileName}</td>
                <td style="word-break: keep-all;">${res[1][i].description}</td>
                ${status}
            </tr>
        `;
    }
    document.getElementById('deleteLog_Select_Lists').innerHTML = html;
    document.getElementById('deleteLog_Select_Loading').style.display = 'none';
    document.getElementById('deleteLog_Select_Main').style.display = 'block';
}

const check = () => { // 체크박스 클릭
    let next_text = $('#deleteLog_Confirm');
    let checkedCount = 0;
    for (let i = 0; i < searchIndex.length; i++) {
        if ($(`input:checkbox[id='${searchIndex[i]}']`).is(":checked")) checkedCount += 1;
    }
    if (checkedCount > 0) {
        next_text.attr('disabled', false);
    } else {
        next_text.attr('disabled', true);
    }
}

const deleteConfirm = () => {
    document.getElementById('cannot_exit_t').style.display = 'block';
    document.getElementById('cannot_exit_b').style.display = 'block';
    document.getElementById('exit_t').style.display = 'none';
    document.getElementById('exit_b').style.display = 'none';

    M.Modal.getInstance(document.getElementById("deleteLog_Select")).close();

    document.getElementById('loading_description1').style.display = 'none';
    document.getElementById('loading_description2').style.display = 'block';

    document.getElementById('loading').style.display = 'block';
    document.getElementById('main').style.display = 'none';

    let sendList = [];
    for (let i = 0; i < searchIndex.length; i++) {
        if ($(`input:checkbox[id='${searchIndex[i]}']`).is(":checked")) sendList.push(`${searchIndex[i]}`);
    }

    ipcRenderer.send('deleteLogs', sendList);
}

/* --------------------------------------------- */

const showErr = msg => {
    document.getElementById('customErr_description').innerHTML = msg;
    M.Modal.getInstance(document.getElementById("customErr")).open();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';
}

const applySetting = () => {
    document.getElementById('cannot_exit_t').style.display = 'block';
    document.getElementById('cannot_exit_b').style.display = 'block';
    document.getElementById('exit_t').style.display = 'none';
    document.getElementById('exit_b').style.display = 'none';

    document.getElementById('loading_description1').style.display = 'none';
    document.getElementById('loading_description2').style.display = 'block';

    document.getElementById('loading').style.display = 'block';
    document.getElementById('main').style.display = 'none';

    // 검증
    let externalPort = parseInt(document.getElementById('port1').value);
    let internalPort = parseInt(document.getElementById('port2').value);
    if (externalPort < 1, externalPort > 65535) {
        showErr("외부 통신 포트(1~65535)가 유효하지 않습니다!");
        throw 'expected';
    }
    if (internalPort < 1, internalPort > 65535) {
        showErr("내부 통신 포트(1~65535)가 유효하지 않습니다!");
        throw 'expected';
    }

    let mode = document.getElementById('Mode').value;
    if (mode !== "Pub" && mode !== "Dev") {
        showErr("실행 모드(일반/개발)가 유효하지 않습니다!");
        throw 'expected';
    }

    let processNF = parseInt(document.getElementById('processNF').value);
    let updateRPC = parseInt(document.getElementById('updateRPC').value);
    if (processNF < 1, processNF > 90301000) {
        showErr("실행 확인 주기(1~90301000ms)가 유효하지 않습니다!");
        throw 'expected';
    }
    if (updateRPC < 1, updateRPC > 90301000) {
        showErr("RPC 갱신 주기(1~90301000ms)가 유효하지 않습니다!");
        throw 'expected';
    }

    ipcRenderer.send('saveConfig', {
        mode,
        externalPort, internalPort,
        processNF, updateRPC
    });
}