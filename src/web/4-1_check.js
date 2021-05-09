window.onload = async () => {
    $('.modal').modal();
    $('.tooltipped').tooltip();
    document.getElementById('linkOpenURL').onmouseover = () => {
        document.getElementById('linkOpenURL').select();
    }

    await wait(100);

    document.getElementById('warnMessage').innerText = ipcRenderer.sendSync('getDeleteWarningMessage', 0);

    $("#agree").attr("disabled", false);
    $("#DelLog").attr("disabled", false);

    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'block';
}

const check = checkbox => {
    let next_text = $('#next-text');
    if (checkbox.checked === true) {
        next_text.attr('disabled', false);
        next_text.removeClass('grey-text');
        next_text.addClass('cyan-text');
    } else if (checkbox.checked === false) {
        next_text.attr('disabled', true);
        next_text.removeClass('cyan-text');
        next_text.addClass('grey-text');
    }
}

const perform = () => {
    document.getElementById('cannot_exit_t').style.display = 'block';
    document.getElementById('cannot_exit_b').style.display = 'block';
    document.getElementById('exit_t').style.display = 'none';
    document.getElementById('exit_b').style.display = 'none';

    document.getElementById('loading').style.display = 'block';
    document.getElementById('main').style.display = 'none';

    ipcRenderer.send('performDel', {
        "agree": ($("input:checkbox[id='agree']").is(":checked") && !$("input:checkbox[id='agree']").is(":disabled")),
        "delAll": ($("input:checkbox[id='DelLog']").is(":checked") && !$("input:checkbox[id='DelLog']").is(":disabled"))
    });
}

ipcRenderer.on('chkErr', (event, store) => {
    document.getElementById('warnMessage').innerText = "잘못된 접근입니다. 다시 시도 해 주세요.";

    $("#agree").attr("disabled", true);
    $("#DelLog").attr("disabled", true);

    $("#agree").attr("checked", false);
    $("#DelLog").attr("checked", false);

    $('#next-text').attr('disabled', true);
    $('#next-text').removeClass('cyan-text');
    $('#next-text').addClass('grey-text');

    M.Modal.getInstance(document.getElementById("chkErr")).open();

    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'block';
});