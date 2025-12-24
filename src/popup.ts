const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let selectedBackup = null;

// Afficher un message de statut
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    if (type !== 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Charger et afficher les sauvegardes
async function loadBackups() {
    const backupList = document.getElementById('backup-list');
    const importBtn = document.getElementById('import-btn');

    try {
        const storage = await browserAPI.storage.local.get(null);
        const backups = Object.keys(storage)
            .filter(key => key.startsWith('anime-sama'))
            .map(key => storage[key])
            .filter(backup => backup && backup.data);

        if (backups.length === 0) {
            backupList.innerHTML = '<div class="empty-state">📭 Aucune sauvegarde disponible</div>';
            importBtn.disabled = true;
            return;
        }

        backupList.innerHTML = '';

        backups.forEach(backup => {
            const item = document.createElement('div');
            item.className = 'backup-item';

            const hostname = document.createElement('div');
            hostname.className = 'backup-hostname';
            hostname.textContent = `📺 ${backup.hostname}`;

            const info = document.createElement('div');
            info.className = 'backup-info';
            const date = new Date(backup.timestamp).toLocaleString('fr-FR');
            const nbKeys = Object.keys(backup.data).length;
            info.textContent = `${nbKeys} entrées • ${date}`;

            item.appendChild(hostname);
            item.appendChild(info);

            // Gestion de la sélection
            item.onclick = () => {
                document.querySelectorAll('.backup-item').forEach(el => {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');
                selectedBackup = backup;
                importBtn.disabled = false;
            };

            backupList.appendChild(item);
        });

    } catch (error) {
        console.error('Erreur chargement backups:', error);
        showStatus('❌ Erreur lors du chargement', 'error');
    }
}

// Importer vers l'onglet actuel
async function importToCurrentTab() {
    if (!selectedBackup) {
        showStatus('⚠️ Sélectionnez d\'abord une sauvegarde', 'error');
        return;
    }

    try {
        // Récupérer l'onglet actif
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        if (!currentTab || !currentTab.id) {
            showStatus('❌ Impossible de détecter l\'onglet actuel', 'error');
            return;
        }

        // Vérifier si c'est un site anime-sama
        const url = currentTab.url || '';
        if (!url.includes('anime-sama')) {
            const confirm = window.confirm(
                `⚠️ L'onglet actuel n'est pas un site anime-sama.\n\n` +
                `URL: ${url}\n\n` +
                `Voulez-vous quand même forcer l'import ?`
            );

            if (!confirm) {
                showStatus('❌ Import annulé', 'info');
                return;
            }
        }

        showStatus('⏳ Import en cours...', 'info');

        // Injecter le script d'import
        await browserAPI.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: (backupData) => {
                let successCount = 0;
                let errorCount = 0;

                Object.entries(backupData).forEach(([key, value]) => {
                    try {
                        const valueToStore = typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value);

                        localStorage.setItem(key, valueToStore);
                        successCount++;
                    } catch (error) {
                        console.error(`Erreur import de ${key}:`, error);
                        errorCount++;
                    }
                });

                return { successCount, errorCount };
            },
            args: [selectedBackup.data]
        });

        showStatus('✅ Import réussi ! Rechargez la page.', 'success');

        // Proposer de recharger la page
        setTimeout(() => {
            if (window.confirm('🔄 Voulez-vous recharger la page maintenant ?')) {
                browserAPI.tabs.reload(currentTab.id);
                window.close();
            }
        }, 1000);

    } catch (error) {
        console.error('Erreur import:', error);
        showStatus(`❌ Erreur: ${error.message}`, 'error');
    }
}

// Supprimer toutes les sauvegardes
async function clearAllBackups() {
    const confirm = window.confirm(
        '⚠️ ATTENTION !\n\n' +
        'Voulez-vous vraiment supprimer TOUTES les sauvegardes ?\n\n' +
        'Cette action est irréversible.'
    );

    if (!confirm) return;

    try {
        const storage = await browserAPI.storage.local.get(null);
        const backupKeys = Object.keys(storage).filter(key => key.startsWith('anime-sama'));

        for (const key of backupKeys) {
            await browserAPI.storage.local.remove(key);
        }

        showStatus(`✅ ${backupKeys.length} sauvegarde(s) supprimée(s)`, 'success');

        // Recharger la liste
        selectedBackup = null;
        await loadBackups();

    } catch (error) {
        console.error('Erreur suppression:', error);
        showStatus('❌ Erreur lors de la suppression', 'error');
    }
}

// Event listeners
document.getElementById('force-import-to-website-btn').addEventListener('click', importToCurrentTab);
document.getElementById('clear-btn').addEventListener('click', clearAllBackups);

// Charger les backups au démarrage
loadBackups();