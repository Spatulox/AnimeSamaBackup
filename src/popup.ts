/// <reference types="chrome" />


let selectedBackup: AnimeBackup | null = null;

async function getCurrentTabName(): Promise<string> {
    const [tab] = await browserAPI.tabs.query({
        active: true,
        currentWindow: true
    });
    return tab?.title || 'Onglet inconnu'
}


// Supprimer toutes les sauvegardes
async function clearAllBackups(): Promise<void> {
    const confirm: boolean = window.confirm(
        '⚠️ ATTENTION !\n\n' +
        'Voulez-vous vraiment supprimer TOUTES les sauvegardes ?\n\n' +
        'Cette action est irréversible.\n\n' +
        'Les données seront re-récupérée depuis anime-sama automatiquement lors d\'un rechargement de la page'
    );

    if (!confirm) return;

    try {
        await browserAPI.storage.local.clear()
        showStatus(`✅ Toutes les sauvegardes ont été supprimée`, Status.success);

        // Recharger la liste
        selectedBackup = null;
        await loadBackups();

    } catch (error: unknown) {
        console.error('Erreur suppression:', error);
        showStatus('❌ Erreur lors de la suppression', Status.error);
    }
}

async function autoImportToSelectedWebsiteTab(): Promise<void> {
    if (!selectedBackup) {
        showStatus('⚠️ Sélectionnez d\'abord une sauvegarde', Status.error);
        return;
    }

    try {
        /*// Chercher onglet anime-sama ouvert
        const animeSamaTabs = await browserAPI.tabs.query({
            // url: '*://*anime-sama*/   // *'
        /*});

        if (animeSamaTabs.length > 0) {
            const tab = animeSamaTabs[0];
            await injectBackupToTab(tab.id!, selectedBackup.data);
            showStatus(`✅ Importé sur ${tab.title} (${tab.url})`, Status.success);
            return;
        }*/

        // Fallback : onglet actif
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        if (currentTab?.id) {
            await injectBackupToTab(currentTab.id, selectedBackup.data);
            showStatus('✅ Importé sur onglet actif', Status.success);
            await browserAPI.tabs.reload(currentTab.id)
        }
    } catch (error: unknown) {
        showStatus(`❌ Erreur: ${(error as Error).message}`, Status.error);
    }
}

async function injectBackupToTab(tabId: number, data: AnimeSamaHistory): Promise<void> {
    const response = await browserAPI.tabs.sendMessage(tabId, {
        action: 'IMPORT_BACKUP',
        data
    });
    console.log('✅ Import via message:', response);
}

// EXPORT JSON
async function exportBackups(): Promise<void> {
    try {
        const storage = await browserAPI.storage.local.get(null);
        const backups: AnimeBackup[] = Object.keys(storage)
            .filter(key => key.startsWith('anime-sama'))
            .map(key => storage[key] as AnimeBackup);

        const json = JSON.stringify(backups, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `anime-sama-backups-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showStatus('✅ Export terminé !', Status.success);
    } catch (error: unknown) {
        showStatus('❌ Erreur export', Status.error);
    }
}

async function loadOption(): Promise<void> {
    if (browserAPI.runtime.openOptionsPage) {
        await browserAPI.runtime.openOptionsPage()
    }
    return
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    (document.getElementById('force-import-to-website-btn') as HTMLElement)?.addEventListener('click', autoImportToSelectedWebsiteTab);
    (document.getElementById('export-btn') as HTMLElement)?.addEventListener('click', exportBackups);
    (document.getElementById('import-btn') as HTMLElement)?.addEventListener('click', loadOption);
    (document.getElementById('clear-btn') as HTMLElement)?.addEventListener('click', clearAllBackups);

    loadBackups();
});