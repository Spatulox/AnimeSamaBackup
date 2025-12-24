/// <reference types="chrome" />

const browserAPIpopup = typeof browser !== 'undefined' ? browser : chrome;


let selectedBackup: AnimeBackup | null = null;

enum Status {
    success = 'success',
    info = 'info',
    error = 'error',
}

async function getCurrentTabName(): Promise<string> {
    const [tab] = await browserAPIpopup.tabs.query({
        active: true,
        currentWindow: true
    });
    return tab?.title || 'Onglet inconnu'
}

// Afficher un message de statut
function showStatus(message: string, type: Status = Status.info): void {
    const statusEl = document.getElementById('status') as HTMLElement;
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    if (type !== Status.error) {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Charger et afficher les sauvegardes
async function loadBackups(): Promise<void> {
    const backupList = document.getElementById('backup-list') as HTMLElement;
    const importBtn = document.getElementById('force-import-to-website-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const webSiteName = document.querySelector('strong') as HTMLElement;

    try {
        const storage = await browserAPIpopup.storage.local.get(null) as Record<string, AnimeBackup | undefined>;
        const backups: AnimeBackup[] = Object.keys(storage)
            .map(key => storage[key]!)
            .filter((backup): backup is AnimeBackup => !!backup && !!backup.data);

        if (backups.length === 0) {
            backupList.innerHTML = '<div class="empty-state">📭 Aucune sauvegarde disponible</div>';
            importBtn.disabled = true;
            exportBtn.disabled = true;
            return;
        }

        backupList.innerHTML = '';
        webSiteName.innerHTML = await getCurrentTabName();

        backups.forEach((backup: AnimeBackup) => {
            const item: HTMLDivElement = document.createElement('div');
            item.className = 'backup-item';

            const hostname: HTMLDivElement = document.createElement('div');
            hostname.className = 'backup-hostname';
            hostname.textContent = `📺 ${backup.hostname}`;

            const info: HTMLDivElement = document.createElement('div');
            info.className = 'backup-info';
            const date: string = new Date(backup.timestamp).toLocaleString('fr-FR');
            const nbKeys: number = Object.keys(backup.data).length;
            info.textContent = `${nbKeys} entrées • ${date}`;

            item.appendChild(hostname);
            item.appendChild(info);

            // Gestion de la sélection
            item.onclick = (): void => {
                document.querySelectorAll('.backup-item').forEach((el: Element) => {
                    (el as HTMLElement).classList.remove('selected');
                });
                item.classList.add('selected');
                selectedBackup = backup;
                importBtn.disabled = false;
            };

            backupList.appendChild(item);
        });

    } catch (error: unknown) {
        console.error('Erreur chargement backups:', error);
        showStatus('❌ Erreur lors du chargement', Status.error);
    }
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
        const storage = await browserAPIpopup.storage.local.get(null) as Record<string, AnimeBackup | undefined>;
        const backupKeys: string[] = Object.keys(storage)

        for (const key of backupKeys) {
            await browserAPIpopup.storage.local.remove(key);
        }

        showStatus(`✅ ${backupKeys.length} sauvegarde(s) supprimée(s)`, Status.success);

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
        const animeSamaTabs = await browserAPIpopup.tabs.query({
            // url: '*://*anime-sama*/   // *'
        /*});

        if (animeSamaTabs.length > 0) {
            const tab = animeSamaTabs[0];
            await injectBackupToTab(tab.id!, selectedBackup.data);
            showStatus(`✅ Importé sur ${tab.title} (${tab.url})`, Status.success);
            return;
        }*/

        // Fallback : onglet actif
        const tabs = await browserAPIpopup.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        if (currentTab?.id) {
            await injectBackupToTab(currentTab.id, selectedBackup.data);
            showStatus('✅ Importé sur onglet actif', Status.success);
            await browserAPIpopup.tabs.reload(currentTab.id)
        }
    } catch (error: unknown) {
        showStatus(`❌ Erreur: ${(error as Error).message}`, Status.error);
    }
}

async function injectBackupToTab(tabId: number, data: AnimeSamaHistory): Promise<void> {
    const response = await browserAPIpopup.tabs.sendMessage(tabId, {
        action: 'IMPORT_BACKUP',
        data
    });
    console.log('✅ Import via message:', response);
}

// EXPORT JSON
async function exportBackups(): Promise<void> {
    try {
        const storage = await browserAPIpopup.storage.local.get(null);
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

// IMPORT JSON
async function importBackups(): Promise<void> {
    showStatus("not implemented", Status.error);
    return

    const fileInput = document.createElement('input') as HTMLInputElement;
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';

    fileInput.onchange = async (e: Event): Promise<void> => {
        console.log("✅ onchange déclenché !");

        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
            showStatus('❌ Aucun fichier sélectionné', Status.error);
            return;
        }

        try {
            showStatus('⏳ Lecture du fichier...', Status.info);
            console.log("ok 1");

            const text = await file.text();
            const backups: AnimeBackup[] = JSON.parse(text);
            console.log("ok 2", backups.length, "backups");

            // Validation
            if (!Array.isArray(backups)) {
                throw new Error('Format JSON invalide : doit être un tableau');
            }
            console.log("ok");
            if (backups.length === 0) {
                throw new Error('Aucune sauvegarde dans le fichier');
            }
            console.log("ok");
            // Import
            for (const backup of backups) {
                if (!backup.hostname || !backup.data || !backup.timestamp) {
                    console.warn('Sauvegarde invalide ignorée:', backup);
                    continue;
                }

                const key = `${backup.hostname}`;
                await browserAPIpopup.storage.local.set({ [key]: backup });
            }
            console.log("ok");
            const importedCount = backups.filter(b => b.hostname && b.data).length;
            showStatus(`✅ ${importedCount}/${backups.length} sauvegarde(s) importée(s)`, Status.success);
            loadBackups();
            console.log("ok");
        } catch (error: unknown) {
            console.error('Erreur import:', error);
            showStatus(
                `❌ Erreur: ${error instanceof Error ? error.message : 'Fichier invalide'}`,
                Status.error
            );
        } finally {
            fileInput.remove();
        }
    };
    document.body.appendChild(fileInput);
    fileInput.click()
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    (document.getElementById('force-import-to-website-btn') as HTMLElement)?.addEventListener('click', autoImportToSelectedWebsiteTab);
    (document.getElementById('export-btn') as HTMLElement)?.addEventListener('click', exportBackups);
    (document.getElementById('import-btn') as HTMLElement)?.addEventListener('click', importBackups);
    (document.getElementById('clear-btn') as HTMLElement)?.addEventListener('click', clearAllBackups);

    loadBackups();
});