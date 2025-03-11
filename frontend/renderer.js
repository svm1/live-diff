const { ipcRenderer } = require('electron');

document.getElementById('select-file-1').addEventListener('click', async () => {
    console.log('clicked file1');
    const filePath = await ipcRenderer.invoke('select-file', 1);
    if (filePath) {
        document.getElementById('file-path-1').textContent = filePath;
        window.selectedFile1 = filePath;
    }
});

document.getElementById('select-file-2').addEventListener('click', async () => {
    console.log('clicked file2');
    const filePath = await ipcRenderer.invoke('select-file', 2);
    if (filePath) {
        document.getElementById('file-path-2').textContent = filePath;
        window.selectedFile2 = filePath;
    }
});

document.getElementById('run-diff').addEventListener('click', async () => {
    console.log('diff click')
    if (!window.selectedFile1 || !window.selectedFile2) {
        document.getElementById('diff-output').textContent = 'Please select both ALS files before running the diff.';
        return;
    }
    
    document.getElementById('diff-output').textContent = 'Running diff...';
    try {
        const diffResult = await ipcRenderer.invoke('run-diff', window.selectedFile1, window.selectedFile2);
        document.getElementById('diff-output').textContent = diffResult;
    } catch (error) {
        document.getElementById('diff-output').textContent = 'Error running diff: ' + error.message;
    }
});

