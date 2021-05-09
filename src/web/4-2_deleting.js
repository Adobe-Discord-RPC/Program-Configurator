window.onload = async () => {
    $('.modal').modal();
    $('.tooltipped').tooltip();
    document.getElementById('linkOpenURL').onmouseover = () => {
        document.getElementById('linkOpenURL').select();
    }
}