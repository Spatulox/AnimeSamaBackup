function importBackups(): void {
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
                await browserAPI.storage.local.set({ [key]: backup });
            }
            console.log("ok");
            const importedCount = backups.filter(b => b.hostname && b.data).length;
            showStatus(`✅ ${importedCount}/${backups.length} sauvegarde(s) importée(s)`, Status.success);
            //loadBackups();
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
    (document.getElementById('import-btn') as HTMLElement)?.addEventListener('click', importBackups);
    //loadBackups();
});