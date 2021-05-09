window.onload = () => {
    $('.modal').modal();
    $('.tooltipped').tooltip();
    document.getElementById('linkOpenURL').onmouseover = () => {
        document.getElementById('linkOpenURL').select();
    }
}

ipcRenderer.on('UpdateErr', (event, store) => {
    document.getElementById('cannot_exit_t').style.display = 'none';
    document.getElementById('cannot_exit_b').style.display = 'none';
    document.getElementById('exit_t').style.display = 'block';
    document.getElementById('exit_b').style.display = 'block';

    $('#exit_btn').attr('disabled', false);
    $('#back_gtn').attr('disabled', false);
});

ipcRenderer.on('changeProgress', async (event, store) => {
    $('#progress_bar').animate({
        width: `${store}%`
    }, 300);
});

ipcRenderer.on('appendLog', (event, store) => {
    let logArea_JS = document.getElementById('logs');
    let logArea_JQ = $('#logs');
    logArea_JS.innerHTML = logArea_JS.innerHTML + '\n' + store;
    logArea_JQ.scrollTop(logArea_JQ.prop('scrollHeight'));
});