const ipcRenderer = require('electron').ipcRenderer;
const wait = require('waait');
const open = require('open');

// 브라우저에서 링크 열기
function openLink(link, re) { // re는 Modal에서 눌렀을 때, Modal 다시 안띄우는 용도!
    if (link === 'undefined') {
        M.Modal.getInstance(document.getElementById('linkNF')).open();
    } else {
        if (re) {
            open(link)
        } else {
            document.getElementById('linkOpenHref').setAttribute("onClick", `openLink('${link}', true);`);
            document.getElementById('linkOpenURL').value = link;
            M.Modal.getInstance(document.getElementById('linkOpened')).open();
            open(link);
        }
    }
}

// 창닫기
function closeWindow() {
    ipcRenderer.send('closeWindow');
}