const browserAPI = typeof browser !== 'undefined' ? browser : chrome;


enum Status {
    success = 'success',
    info = 'info',
    error = 'error',
}

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

async function loadBackups(): Promise<void> {
    const backupList = document.getElementById('backup-list') as HTMLElement;
    const importBtn = document.getElementById('force-import-to-website-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const webSiteName = document.querySelector('strong') as HTMLElement;

    try {
        const storage = await browserAPI.storage.local.get(null) as Record<string, AnimeBackup | undefined>;
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